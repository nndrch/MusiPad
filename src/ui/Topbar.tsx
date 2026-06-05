import { FileMusic, X } from 'lucide-react';
import type { ScoreInfo } from '../model/scoreInfo';
import './Topbar.css';

interface TopbarProps {
  fileName: string;
  /** Key / Tempo summary read from the score (display-only until M4). */
  info: ScoreInfo;
  /** Close the current score and return to the empty state. */
  onClose: () => void;
}

/**
 * Slim topbar (PRD §6.2). M1 shows the loaded file name, a read-only Key /
 * Tempo summary, and a way back to the dropzone. Undo/Redo and the orange
 * Download button arrive in M3 / M7.
 */
export function Topbar({ fileName, info, onClose }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__file">
        <FileMusic size={16} strokeWidth={1.75} />
        <span className="topbar__name">{fileName}</span>
      </div>

      <div className="topbar__meta">
        <span className="topbar__chip" title="Key signature">
          <span className="topbar__chip-label">Key</span>
          {info.key ?? '—'}
        </span>
        <span className="topbar__chip" title="Tempo (quarter-notes per minute)">
          <span className="topbar__chip-label">Tempo</span>
          {info.tempo != null ? `${info.tempo} BPM` : '—'}
        </span>
        <span className="topbar__chip" title="Style / feel marking">
          <span className="topbar__chip-label">Feel</span>
          {info.style ?? '—'}
        </span>
      </div>

      <div className="topbar__spacer" />
      <button type="button" className="topbar__btn" onClick={onClose}>
        <X size={14} strokeWidth={1.75} />
        Close
      </button>
    </header>
  );
}
