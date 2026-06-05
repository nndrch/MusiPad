import { useRef, useState, type DragEvent } from 'react';
import { Music } from 'lucide-react';
import './Dropzone.css';

const ACCEPT = '.xml,.musicxml,.mxl';

interface DropzoneProps {
  /** Called with the chosen file. Wired to LocalFileIO in M1. */
  onFile?: (file: File) => void;
}

/**
 * Empty-state dropzone (PRD §6.2). M0: visual + interaction shell only —
 * actual load/unzip lands in M1 via the ScoreIO adapter.
 */
export function Dropzone({ onFile }: DropzoneProps) {
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
