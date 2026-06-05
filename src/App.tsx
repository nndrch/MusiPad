import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { LocalFileIO } from './io/LocalFileIO';
import { parseXml } from './model/xmlDoc';
import { readScoreInfo } from './model/scoreInfo';
import { OsmdView } from './render/OsmdView';
import { Transport } from './audio/Transport';
import { useTransport } from './audio/useTransport';
import { useScoreEditor } from './store/useScoreEditor';
import { Dropzone } from './ui/Dropzone';
import { Topbar } from './ui/Topbar';
import './App.css';

/**
 * App shell (M1). Empty state → dropzone; once a score loads, the topbar +
 * score canvas. The MusicXML `Document` is the single source of truth
 * (Invariant #1); OSMD renders from it.
 */
export default function App() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const io = new LocalFileIO(file);
      const text = await io.load();
      setDoc(parseXml(text));
      setFileName(file.name);
    } catch (err) {
      setDoc(null);
      setFileName(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleClose() {
    setDoc(null);
    setFileName(null);
    setError(null);
  }

  if (!doc || !fileName) {
    return <Dropzone onFile={handleFile} error={error} />;
  }

  return <Score doc={doc} fileName={fileName} onClose={handleClose} />;
}

interface ScoreProps {
  doc: Document;
  fileName: string;
  onClose: () => void;
}

/** Loaded-score view: header summary + scaled score canvas + playback transport. */
function Score({ doc, fileName, onClose }: ScoreProps) {
  // The command layer (M3). `revision` bumps on every edit; thread it into
  // anything derived from the (in-place-mutated) DOM so it refreshes. The
  // editor's `dispatch` gains its triggering UI (Key/Tempo controls) in M4.
  const { undo, redo, canUndo, canRedo, revision } = useScoreEditor(doc);

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

  // Keyboard: ⌘Z / Ctrl+Z undo, ⌘⇧Z / Ctrl+Shift+Z redo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return (
    <div className="app">
      <Topbar
        fileName={fileName}
        info={info}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onClose={onClose}
      />
      <OsmdView doc={doc} onRendered={handleRendered} revision={revision} />
      <Transport controls={transport} />
    </div>
  );
}
