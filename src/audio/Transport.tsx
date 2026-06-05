import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { TransportControls } from './useTransport';
import './Transport.css';

interface TransportProps {
  controls: TransportControls;
}

/** Metronome glyph (custom). Uses `currentColor` so it follows the toggle's
 *  grayscale-off / accent-on states (PRD §6.2). */
function MetronomeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.5751 13.2589L19.061 18.9325C19.31 19.8832 18.5928 20.8125 17.61 20.8125H6.38974C5.40696 20.8125 4.68968 19.8832 4.93868 18.9325L8.76904 4.30746C8.94184 3.64766 9.53804 3.1875 10.2201 3.1875H13.7796C14.4617 3.1875 15.0579 3.64766 15.2307 4.30746L15.6772 6.01231"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.9998 15.7767L18.9239 6.96423"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M6.33472 15.7767L17.6651 15.7767"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Playback transport footer (PRD §6.2, M2): play/pause, a seek bar with the
 * playhead in `--accent`, elapsed / total time, and a quiet metronome toggle
 * (grayscale off → accent on). Disabled until a playable schedule exists.
 */
export function Transport({ controls }: TransportProps) {
  const { state, toggle, seek, setMetronome } = controls;
  const { positionSec, durationSec, isPlaying, metronome } = state;
  const disabled = durationSec <= 0;

  // While dragging, show the dragged value (not the live playhead) so the thumb
  // doesn't fight the ~40×/s position updates during playback.
  const [scrub, setScrub] = useState<number | null>(null);
  const shownPosition = scrub ?? positionSec;
  const progress = durationSec > 0 ? (shownPosition / durationSec) * 100 : 0;

  return (
    <footer className="transport">
      <button
        type="button"
        className="transport__play"
        onClick={toggle}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={18} strokeWidth={2} fill="currentColor" />
        ) : (
          <Play size={18} strokeWidth={2} fill="currentColor" />
        )}
      </button>

      <span className="transport__time" aria-hidden="true">
        {formatTime(shownPosition)}
      </span>

      <input
        type="range"
        className="transport__seek"
        min={0}
        max={durationSec || 1}
        step={0.01}
        value={Math.min(shownPosition, durationSec || 1)}
        onChange={(e) => {
          const value = Number(e.target.value);
          setScrub(value);
          seek(value);
        }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        onBlur={() => setScrub(null)}
        disabled={disabled}
        aria-label="Seek"
        style={{ '--progress': `${progress}%` } as React.CSSProperties}
      />

      <span className="transport__time transport__time--total" aria-hidden="true">
        {formatTime(durationSec)}
      </span>

      <button
        type="button"
        className={`transport__metronome${metronome ? ' is-on' : ''}`}
        onClick={() => setMetronome(!metronome)}
        disabled={disabled}
        aria-pressed={metronome}
        aria-label="Metronome"
        title="Metronome (click on every beat)"
      >
        <MetronomeIcon size={18} />
      </button>
    </footer>
  );
}

/** Seconds → `m:ss` for the transport readout. */
function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
