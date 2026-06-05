import { useRef, useState, type DragEvent } from 'react';
import { Music } from 'lucide-react';
import './Dropzone.css';

const ACCEPT = '.xml,.musicxml,.mxl';

interface DropzoneProps {
  /** Called with the chosen file; App routes it through LocalFileIO. */
  onFile?: (file: File) => void;
  /** Message shown when the last load/parse attempt failed. */
  error?: string | null;
}

/**
 * Empty-state dropzone (PRD §6.2). Captures a `File` (drag-drop or picker)
 * and hands it up; all reading/unzipping happens in the IO layer (§7.5).
 */
export function Dropzone({ onFile, error }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile?.(file);
  };

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Drop a MusicXML file or click to choose"
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Music className="dropzone__icon" size={32} strokeWidth={1.5} />
        <div className="dropzone__title">
          Drop a MusicXML file or click to choose
        </div>
        <div className="dropzone__hint">
          Load a generated score to start correcting it.
        </div>
        <div className="dropzone__formats">.xml · .musicxml · .mxl</div>
        {error && <div className="dropzone__error">{error}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile?.(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
