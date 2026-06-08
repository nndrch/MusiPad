import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { LocalFileIO } from './io/LocalFileIO';
import { parseXml } from './model/xmlDoc';
import { applyDefaults, type DefaultsApplied } from './model/defaults';
import { readScoreInfo } from './model/scoreInfo';
import { OsmdView } from './render/OsmdView';
import { Transport } from './audio/Transport';
import { useTransport } from './audio/useTransport';
import { useScoreEditor } from './store/useScoreEditor';
import { setKeySignature } from './commands/key';
import { transpose } from './commands/transpose';
import { setTempo } from './commands/tempo';
import { removeChordAt, setChordAt } from './commands/chord';
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

  async function handleFile(file: File) {
    setError(null);
    try {
      const io = new LocalFileIO(file);
      const text = await io.load();
      const parsed = parseXml(text);
      // Assign C major / 120 BPM if the file is missing them (PRD §11);
      // `defaults` (a fresh object per load) drives the dismissible alert.
      setDefaults(applyDefaults(parsed));
      setDoc(parsed);
      setFileName(file.name);
    } catch (err) {
      setDoc(null);
      setFileName(null);
      setDefaults(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleClose() {
    setDoc(null);
    setFileName(null);
    setDefaults(null);
    setError(null);
  }

  if (!doc || !fileName || !defaults) {
    return <Dropzone onFile={handleFile} error={error} />;
  }

  return (
    <Score
      doc={doc}
      fileName={fileName}
      defaults={defaults}
      onClose={handleClose}
    />
  );
}

interface ScoreProps {
  doc: Document;
  fileName: string;
  defaults: DefaultsApplied;
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
function Score({ doc, fileName, defaults, onClose }: ScoreProps) {
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

  // Bar selection (M5) — ephemeral *view* state, not a Command (Invariant #3
  // governs DOM mutations; selection touches neither the DOM nor undo/redo).
  // Cleared when a new score loads, via the adjust-state-in-render pattern
  // (same as the banner below) to avoid a setState-in-effect cascade.
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null);
  const [selectionDoc, setSelectionDoc] = useState(doc);
  if (selectionDoc !== doc) {
    setSelectionDoc(doc);
    setSelectedMeasure(null);
  }

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
        onClose={onClose}
      />
      <Toolbar
        info={info}
        onSetKey={(fifths, mode) => dispatch(setKeySignature(fifths, mode))}
        onTranspose={(semitones) => dispatch(transpose(semitones))}
        onSetTempo={(bpm) => dispatch(setTempo(bpm))}
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
      />
      <Transport controls={transport} />
    </div>
  );
}
