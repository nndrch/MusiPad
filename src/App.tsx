import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Transport } from './audio/Transport';
import { useTransport } from './audio/useTransport';
import { useScoreEditor } from './store/useScoreEditor';
import { setKeySignature } from './commands/key';
import { transpose } from './commands/transpose';
import { setTempo } from './commands/tempo';
import { setMeter } from './commands/meter';
import { removeChordAt, setChordAt } from './commands/chord';
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
import './print.css';

// M9: Download + Playback are set aside while we focus the chord-chart rendering
// pass — hidden for now (flip these to re-enable). Typed as boolean so the JSX
// guards don't read as constant-false conditions.
const ENABLE_PLAYBACK: boolean = false;
const ENABLE_DOWNLOAD: boolean = false;

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
  const { previewChord, seek, seekToMeasure } = transport;
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

  // Download (M7): serialize the live DOM (commands mutate it in place, so this
  // captures every edit) and save through the IO seam (PRD §7.5). `serializeXml`
  // re-emits the captured declaration/DOCTYPE and unedited regions stay
  // byte-identical to the load baseline (Invariant #2). No success toast in M7 —
  // deferred to M9 (ui-decisions A4). Print is browser-native via `@media print`.
  const handleDownload = useCallback(() => {
    void io.save(serializeXml(doc));
  }, [io, doc]);
  const handlePrint = useCallback(() => window.print(), []);

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
      const target =
        selectedMeasure ??
        firstFreeMeasure(
          doc,
          readChartSections(doc).map((s) => s.measureIndex),
        );
      if (target == null) return;
      dispatch(addSection(target, label));
    },
    [dispatch, doc, selectedMeasure],
  );
  const handleAddAnnotation = useCallback(() => {
    const annotated = readChartAnnotations(doc).map((a) => a.measureIndex);
    const target = selectedMeasure ?? firstFreeMeasure(doc, annotated);
    if (target == null) return;
    // Skip a no-op dispatch (and its phantom undo step) if the bar already has
    // an annotation (an explicitly selected bar may) — just reopen its editor.
    if (!annotated.includes(target)) {
      dispatch(addAnnotation(target, ''));
    }
    setPendingAnnotation(target);
  }, [dispatch, doc, selectedMeasure]);
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

  // Selecting a bar **cues the play-start**: Play begins from the selected bar;
  // with nothing selected it plays from the top. We do this by seeking the
  // (paused) playhead to the bar on select, and back to 0 on deselect — so the
  // transport just plays from its current position. While playing we don't seek
  // here: bar clicks already seek via onSeekMeasure (B5.8), and Esc/deselect
  // must not yank playback back to the start.
  const isPlaying = transport.state.isPlaying;
  const handleSelectMeasure = useCallback(
    (measureIndex: number | null) => {
      setSelectedMeasure(measureIndex);
      if (!isPlaying) {
        if (measureIndex == null) seek(0);
        else seekToMeasure(measureIndex);
      }
    },
    [isPlaying, seek, seekToMeasure],
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
        onDownload={handleDownload}
        showDownload={ENABLE_DOWNLOAD}
        onPrint={handlePrint}
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
        onRendered={handleRendered}
        revision={revision}
        selectedMeasure={selectedMeasure}
        onSelectMeasure={handleSelectMeasure}
        onSeekMeasure={transport.seekToMeasure}
        playingMeasure={transport.state.currentMeasure}
        isPlaying={transport.state.isPlaying}
        onSetChord={handleSetChord}
        onRemoveChord={handleRemoveChord}
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
      {ENABLE_PLAYBACK && <Transport controls={transport} />}
    </div>
  );
}
