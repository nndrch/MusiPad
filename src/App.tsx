import { useMemo, useState } from 'react';
import { LocalFileIO } from './io/LocalFileIO';
import { parseXml } from './model/xmlDoc';
import { readScoreInfo } from './model/scoreInfo';
import { OsmdView } from './render/OsmdView';
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

/** Loaded-score view: header summary + scaled score canvas. */
function Score({ doc, fileName, onClose }: ScoreProps) {
  const info = useMemo(() => readScoreInfo(doc), [doc]);
  return (
    <div className="app">
      <Topbar fileName={fileName} info={info} onClose={onClose} />
      <OsmdView doc={doc} />
    </div>
  );
}
