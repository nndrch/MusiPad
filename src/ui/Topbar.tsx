import {
  AudioLines,
  Download,
  FileMusic,
  FileText,
  Redo2,
  ScrollText,
  Undo2,
  X,
} from 'lucide-react';
import type { ViewMode } from '../render/useOsmd';
import './Topbar.css';

// The undo/redo handler accepts both ⌘ (Mac) and Ctrl (Windows/Linux); show the
// matching hint in the button tooltips.
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
const UNDO_HINT = IS_MAC ? '⌘Z' : 'Ctrl+Z';
const REDO_HINT = IS_MAC ? '⌘⇧Z' : 'Ctrl+Shift+Z';

interface TopbarProps {
  fileName: string;
  /** Undo/redo wiring from the command layer (M3). */
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Export the live DOM as a corrected `.musicxml` download (M7, surfaced M12). */
  onExport: () => void;
  /** Open the picker to load the recording to review against (M13). */
  onLoadAudio: () => void;
  /** Whether a recording is currently loaded (M13) — drives the button label. */
  audioLoaded?: boolean;
  /** Current layout mode (M10) — paginated A4 (`page`) vs continuous (`full`). */
  viewMode: ViewMode;
  /** Switch the layout mode (M10). */
  onViewModeChange: (mode: ViewMode) => void;
  /** Close the current score and return to the empty state. */
  onClose: () => void;
}

/**
 * Slim topbar (PRD §6.2). Shows the loaded file name, Undo/Redo (M3) —
 * disabled/faint when their stack is empty (PRD §6.4) — and a single orange
 * **Export** primary (the app's only accent button, PRD §6.1/§6.2), the tool's
 * output of record. (Print was retired in M12 — §3.) Key / Tempo / Feel are
 * surfaced by the toolbar controls and the document subline (M4), not here.
 */
export function Topbar({
  fileName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onLoadAudio,
  audioLoaded = false,
  viewMode,
  onViewModeChange,
  onClose,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__file">
        <FileMusic size={16} strokeWidth={1.75} />
        <span className="topbar__name">{fileName}</span>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title={`Undo (${UNDO_HINT})`}
        >
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="topbar__icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title={`Redo (${REDO_HINT})`}
        >
          <Redo2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div
        className="topbar__viewtoggle"
        role="group"
        aria-label="Layout view"
      >
        <button
          type="button"
          className="topbar__seg"
          aria-pressed={viewMode === 'page'}
          onClick={() => onViewModeChange('page')}
          title="Page layout (A4 sheets)"
        >
          <FileText size={14} strokeWidth={1.75} />
          Page
        </button>
        <button
          type="button"
          className="topbar__seg"
          aria-pressed={viewMode === 'full'}
          onClick={() => onViewModeChange('full')}
          title="Fullscreen (continuous scroll)"
        >
          <ScrollText size={14} strokeWidth={1.75} />
          Full
        </button>
      </div>

      <button
        type="button"
        className="topbar__btn"
        onClick={onLoadAudio}
        title={
          audioLoaded
            ? 'Recording loaded — click to replace'
            : 'Load the recording to play along with (audio + .bpm sidecar)'
        }
      >
        <AudioLines size={14} strokeWidth={1.75} />
        {audioLoaded ? 'Audio ✓' : 'Load audio'}
      </button>

      <button
        type="button"
        className="topbar__btn topbar__btn--primary"
        onClick={onExport}
        title="Export the corrected MusicXML"
      >
        <Download size={14} strokeWidth={1.75} />
        Export
      </button>

      <button type="button" className="topbar__btn" onClick={onClose}>
        <X size={14} strokeWidth={1.75} />
        Close
      </button>
    </header>
  );
}
