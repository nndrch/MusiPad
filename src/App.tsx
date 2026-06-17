import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { LocalFileIO } from './io/LocalFileIO';
import type { ScoreIO } from './io/ScoreIO';
import { parseXml, serializeXml } from './model/xmlDoc';
import {
  applyDefaults,
  normalizeSectionBarlines,
  type DefaultsApplied,
} from './model/defaults';
import { applySlashGrid } from './model/slashGrid';
import { readScoreInfo } from './model/scoreInfo';
import { OsmdView } from './render/OsmdView';
import type { ViewMode } from './render/useOsmd';
import { Transport } from './audio/Transport';
import { useTransport } from './audio/useTransport';
import { useScoreEditor } from './store/useScoreEditor';
import { setKeySignature } from './commands/key';
import { transpose } from './commands/transpose';
import { setTempo } from './commands/tempo';
import { setMeter } from './commands/meter';
import { moveChord, removeChordAt, setChordAt } from './commands/chord';
import {
  addSection,
  editSection,
  moveSection,
  removeSection,
} from './commands/section';
import {
  addAnnotation,
  editAnnotation,
  moveAnnotation,
  removeAnnotation,
} from './commands/annotation';
import {
  firstFreeMeasure,
  readChartAnnotations,
  readChartSections,
} from './model/directions';
import { voicingFromSpec } from './audio/voicing';
import type { ChordSpec } from './model/chordSymbol';
import { Dropzone } from './ui/Dropzone';
import { Topbar } from './ui/Topbar';
import { Toolbar } from './ui/Toolbar';
import { Banner } from './ui/Banner';
import './App.css';

/**
 * App shell (M1). Empty state → dropzone; once a score loads, the topbar +
 * score canvas. The MusicXML `Document` is the single source of truth
 * (Invariant #1); OSMD renders from it.
 */
export default function App() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<DefaultsApplied | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The IO adapter is retained after load so Download (M7) can save through the
  // same seam (PRD §7.5) and reuse the source filename — see `Score`.
  const [io, setIo] = useState<ScoreIO | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const fileIo = new LocalFileIO(file);
      const text = await fileIo.load();
      const parsed = parseXml(text);
      // Assign C major / 120 BPM if the file is missing them (PRD §11);
      // `defaults` (a fresh object per load) drives the dismissible alert.
      setDefaults(applyDefaults(parsed));
      // M9: normalize every bar to a per-beat slash grid (the chart's bars are
      // uniform slashes) so the displayed grid == the editable DOM and a chord
      // attaches to any beat. Folded into the load baseline like the defaults.
      applySlashGrid(parsed, { force: true });
      // M9: open pre-existing section bars with the double barline (PRD §6.5),
      // folded into the load baseline like the key/tempo defaults above.
      normalizeSectionBarlines(parsed);
      setDoc(parsed);
      setFileName(file.name);
      setIo(fileIo);
    } catch (err) {
      setDoc(null);
      setFileName(null);
      setDefaults(null);
      setIo(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleClose() {
    setDoc(null);
    setFileName(null);
    setDefaults(null);
    setIo(null);
    setError(null);
  }

  if (!doc || !fileName || !defaults || !io) {
    return <Dropzone onFile={handleFile} error={error} />;
  }

  return (
    <Score
      doc={doc}
      fileName={fileName}
      defaults={defaults}
      io={io}
      onClose={handleClose}
    />
  );
}

interface ScoreProps {
  doc: Document;
  fileName: string;
  defaults: DefaultsApplied;
  io: ScoreIO;
  onClose: () => void;
}

/** Human message for the defaults-assigned alert. */
function defaultsMessage(d: DefaultsApplied): string {
  if (d.key && d.tempo) {
    return 'This file had no key or tempo — defaulted to C major and 120 BPM. Adjust them in the toolbar.';
  }
  if (d.key) {
    return 'This file had no key signature — defaulted to C major. Change it in the toolbar.';
  }
  return 'This file had no tempo — defaulted to 120 BPM. Change it in the toolbar.';
}

/** Loaded-score view: header summary + scaled score canvas + playback transport. */
function Score({ doc, fileName, defaults, io, onClose }: ScoreProps) {
  // The command layer (M3). `revision` bumps on every edit; thread it into
  // anything derived from the (in-place-mutated) DOM so it refreshes. The
  // Toolbar (M4) is the first UI to dispatch real edits.
  const { dispatch, undo, redo, canUndo, canRedo, revision } =
    useScoreEditor(doc);

  // `revision` is an intentional dep: commands mutate `doc` in place (its
  // identity is unchanged), so the header chips must re-read on each edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => readScoreInfo(doc), [doc, revision]);

  // The OSMD instance + a render counter let the transport build its schedule
  // and re-link the cursor after each render (M2). A command edit bumps
  // `revision` → OSMD re-renders → `renderTick` → the transport rebuilds.
  const [osmd, setOsmd] = useState<OpenSheetMusicDisplay | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const handleRendered = useCallback((instance: OpenSheetMusicDisplay) => {
    setOsmd(instance);
    setRenderTick((tick) => tick + 1);
  }, []);

  const transport = useTransport(doc, osmd, renderTick);

  // Chord edits (M6). Each goes through the command layer (undoable, Invariant
  // #3); adding/updating also auditions the new chord (B6.12) via the same
  // voicing path playback uses. `previewChord` is a stable callback, so these
  // handlers keep a stable identity (the memoized chord layer doesn't churn).
  const { previewChord, seekToMeasure, loadAudio, toggle, pause } = transport;

  // The playhead's current bar (a ref so the add-handlers below stay stable
  // across the ~per-bar updates during playback). Used to target the current
  // bar when adding a section/note while playing (M13).
  const currentMeasureRef = useRef(transport.state.currentMeasure);
  useEffect(() => {
    currentMeasureRef.current = transport.state.currentMeasure;
  }, [transport.state.currentMeasure]);

  // Starting any edit (opening a chord/mark editor) pauses the recording at the
  // playhead; the reviewer resumes manually (M13). Pause-only, never auto-resume.
  const handleEditingChange = useCallback(
    (open: boolean) => {
      if (open) pause();
    },
    [pause],
  );

  // Recording (M13): load the paired stabilised audio + its `.bpm` via a hidden
  // multi-file picker. The generated chart carries no tempo, so the `.bpm` drives
  // playback; the audio then plays in sync and the bar-highlight follows it (§6.7).
  const audioInputRef = useRef<HTMLInputElement>(null);
  const openAudioPicker = useCallback(() => audioInputRef.current?.click(), []);
  const handleAudioFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      const audioFile = list.find(
        (f) =>
          f.type.startsWith('audio/') ||
          /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.name),
      );
      if (!audioFile) return;
      const bpmFile = list.find((f) => /\.bpm$/i.test(f.name));
      const bpm = bpmFile ? parseFloat((await bpmFile.text()).trim()) : 0;
      loadAudio(audioFile, bpm);
    },
    [loadAudio],
  );
  const auditionSpec = useCallback(
    (spec: ChordSpec) => {
      const voicing = voicingFromSpec(spec);
      if (voicing) previewChord(voicing.pitches);
    },
    [previewChord],
  );
  const handleSetChord = useCallback(
    (measureIndex: number, entryIndex: number, spec: ChordSpec) => {
      dispatch(setChordAt(measureIndex, entryIndex, spec));
      auditionSpec(spec);
    },
    [dispatch, auditionSpec],
  );
  const handleRemoveChord = useCallback(
    (measureIndex: number, entryIndex: number) => {
      dispatch(removeChordAt(measureIndex, entryIndex));
    },
    [dispatch],
  );
  const handleMoveChord = useCallback(
    (fromM: number, fromE: number, toM: number, toE: number) => {
      dispatch(moveChord(fromM, fromE, toM, toE));
    },
    [dispatch],
  );

  // Download (M7): serialize the live DOM (commands mutate it in place, so this
  // captures every edit) and save through the IO seam (PRD §7.5). `serializeXml`
  // re-emits the captured declaration/DOCTYPE and unedited regions stay
  // byte-identical to the load baseline (Invariant #2). The tool's deliverable —
  // surfaced as "Export" in M12 (Print retired; see PrintView, kept dormant).
  const handleExport = useCallback(() => {
    void io.save(serializeXml(doc));
  }, [io, doc]);

  // View mode (M10, PRD §6.6): paginated A4 pages vs continuous scroll.
  // Defaults to page layout (the print-friendly showcase); toggled in the topbar.
  const [viewMode, setViewMode] = useState<ViewMode>('page');

  // Bar selection (M5) — ephemeral *view* state, not a Command (Invariant #3
  // governs DOM mutations; selection touches neither the DOM nor undo/redo).
  // Cleared when a new score loads, via the adjust-state-in-render pattern
  // (same as the banner below) to avoid a setState-in-effect cascade.
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null);
  // Bar whose annotation editor should auto-open after ＋Note (M7); the
  // annotation overlay consumes it once opened.
  const [pendingAnnotation, setPendingAnnotation] = useState<number | null>(null);
  const [selectionDoc, setSelectionDoc] = useState(doc);
  if (selectionDoc !== doc) {
    setSelectionDoc(doc);
    setSelectedMeasure(null);
    setPendingAnnotation(null);
  }

  // Section + annotation authoring (M7) — undoable commands. The target bar is
  // the selected one if a bar is selected; otherwise we drop the mark on the
  // first bar that has no mark of that kind, so a toolbar add never silently
  // overwrites an existing one (B7.2/B7.3). If every bar already has that mark
  // and nothing is selected, it's a no-op. ＋Note also queues the new
  // annotation's inline editor to open (pendingAnnotation).
  const handleAddSection = useCallback(
    (label: string) => {
      const playhead = currentMeasureRef.current;
      const target =
        selectedMeasure ??
        (playhead >= 0
          ? playhead
          : firstFreeMeasure(
              doc,
              readChartSections(doc).map((s) => s.measureIndex),
            ));
      if (target == null) return;
      pause();
      dispatch(addSection(target, label));
    },
    [dispatch, doc, selectedMeasure, pause],
  );
  const handleAddAnnotation = useCallback(() => {
    const annotated = readChartAnnotations(doc).map((a) => a.measureIndex);
    const playhead = currentMeasureRef.current;
    const target =
      selectedMeasure ??
      (playhead >= 0 ? playhead : firstFreeMeasure(doc, annotated));
    if (target == null) return;
    pause();
    // Skip a no-op dispatch (and its phantom undo step) if the bar already has
    // an annotation (the selected/current bar may) — just reopen its editor.
    if (!annotated.includes(target)) {
      dispatch(addAnnotation(target, ''));
    }
    setPendingAnnotation(target);
  }, [dispatch, doc, selectedMeasure, pause]);
  const handleEditSection = useCallback(
    (measureIndex: number, label: string) =>
      dispatch(editSection(measureIndex, label)),
    [dispatch],
  );
  const handleRemoveSection = useCallback(
    (measureIndex: number) => dispatch(removeSection(measureIndex)),
    [dispatch],
  );
  const handleMoveSection = useCallback(
    (from: number, to: number) => dispatch(moveSection(from, to)),
    [dispatch],
  );
  const handleEditAnnotation = useCallback(
    (measureIndex: number, text: string) =>
      dispatch(editAnnotation(measureIndex, text)),
    [dispatch],
  );
  const handleRemoveAnnotation = useCallback(
    (measureIndex: number) => dispatch(removeAnnotation(measureIndex)),
    [dispatch],
  );
  const handleMoveAnnotation = useCallback(
    (from: number, to: number) => dispatch(moveAnnotation(from, to)),
    [dispatch],
  );
  const consumePendingAnnotation = useCallback(
    () => setPendingAnnotation(null),
    [],
  );

  const hasAudio = transport.state.hasAudio;
  // Selection is pure *view* state (Invariant #3) — it never moves the playhead,
  // so editing a chord and clicking away can't yank playback back to the start.
  const handleSelectMeasure = useCallback(
    (measureIndex: number | null) => setSelectedMeasure(measureIndex),
    [],
  );
  // Clicking a bar drives playback (M13): seek the recording to that bar and
  // toggle play/pause — a click starts playing from there, and a click while
  // playing pauses at it. No-op without a recording (the transport is hidden).
  const handleActivateMeasure = useCallback(
    (measureIndex: number) => {
      if (!hasAudio) return;
      seekToMeasure(measureIndex);
      toggle();
    },
    [hasAudio, seekToMeasure, toggle],
  );

  // Dismissible alert when defaults were assigned on load (PRD §11). Reset when
  // a new file loads (a fresh `defaults` object) by adjusting state in render.
  const [dismissedFor, setDismissedFor] = useState<DefaultsApplied | null>(
    null,
  );
  if (dismissedFor !== null && dismissedFor !== defaults) setDismissedFor(null);
  const showBanner =
    (defaults.key || defaults.tempo) && dismissedFor !== defaults;

  // Keyboard: Esc clears bar selection (M5); ⌘Z / Ctrl+Z undo, ⌘⇧Z redo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleSelectMeasure(null);
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, handleSelectMeasure]);

  return (
    <div className="app">
      <Topbar
        fileName={fileName}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onExport={handleExport}
        onLoadAudio={openAudioPicker}
        audioLoaded={transport.state.hasAudio}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onClose={onClose}
      />
      <Toolbar
        info={info}
        onSetKey={(fifths, mode) => dispatch(setKeySignature(fifths, mode))}
        onTranspose={(semitones) => dispatch(transpose(semitones))}
        onSetTempo={(bpm) => dispatch(setTempo(bpm))}
        onSetMeter={(beats, beatType) => dispatch(setMeter(beats, beatType))}
        onAddSection={handleAddSection}
        onAddAnnotation={handleAddAnnotation}
      />
      {showBanner && (
        <Banner
          message={defaultsMessage(defaults)}
          onDismiss={() => setDismissedFor(defaults)}
        />
      )}
      <OsmdView
        doc={doc}
        info={info}
        viewMode={viewMode}
        onRendered={handleRendered}
        revision={revision}
        selectedMeasure={selectedMeasure}
        onSelectMeasure={handleSelectMeasure}
        onSeekMeasure={handleActivateMeasure}
        playingMeasure={transport.state.currentMeasure}
        isPlaying={transport.state.isPlaying}
        followPlayhead={transport.followPlayhead}
        onEditingChange={handleEditingChange}
        onSetChord={handleSetChord}
        onRemoveChord={handleRemoveChord}
        onMoveChord={handleMoveChord}
        onPreviewChord={auditionSpec}
        onEditSection={handleEditSection}
        onRemoveSection={handleRemoveSection}
        onMoveSection={handleMoveSection}
        onEditAnnotation={handleEditAnnotation}
        onRemoveAnnotation={handleRemoveAnnotation}
        onMoveAnnotation={handleMoveAnnotation}
        pendingAnnotation={pendingAnnotation}
        onConsumePendingAnnotation={consumePendingAnnotation}
      />
      {/* Hidden multi-file picker for the recording (audio + .bpm [+ .json]). */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.bpm,.json"
        multiple
        hidden
        onChange={(e) => {
          void handleAudioFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* The transport appears only once a recording is loaded (M13). */}
      {transport.state.hasAudio && <Transport controls={transport} />}
    </div>
  );
}
