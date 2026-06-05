import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { keyLabel, type ScoreInfo } from '../model/scoreInfo';
import './Toolbar.css';

// Tempo bounds for the input (quarter-notes/min). Generous but sane.
const MIN_BPM = 20;
const MAX_BPM = 400;

interface KeyOption {
  value: string; // "fifths:mode"
  label: string;
}

/** Major and minor key signatures, fifths −7…+7 (PRD §6.3 "dropdown of keys"). */
function buildKeyOptions(mode: 'major' | 'minor'): KeyOption[] {
  const opts: KeyOption[] = [];
  for (let fifths = -7; fifths <= 7; fifths++) {
    opts.push({ value: `${fifths}:${mode}`, label: keyLabel(fifths, mode) });
  }
  return opts;
}
const MAJOR_KEYS = buildKeyOptions('major');
const MINOR_KEYS = buildKeyOptions('minor');

interface ToolbarProps {
  info: ScoreInfo;
  /** Relabel the key signature (no pitch change). */
  onSetKey: (fifths: number, mode: string) => void;
  /** Transpose the whole chart by ±1 semitone (pitches + key + chords). */
  onTranspose: (semitones: number) => void;
  /** Set the initial tempo (BPM); drives playback. */
  onSetTempo: (bpm: number) => void;
}

/**
 * Global-edit toolbar (PRD §6.2, M4): Key relabel ▾, Transpose ±, Tempo input.
 * Quiet and inline per the design language (§6.1) — these are the only global
 * controls. Each control's change dispatches an undoable command via App.
 */
export function Toolbar({ info, onSetKey, onTranspose, onSetTempo }: ToolbarProps) {
  const keyId = useId();
  const tempoId = useId();

  // Current key as the select's value. If the chart's mode isn't major/minor
  // (a church mode) or there's no key, the value won't match a listed option —
  // we surface it as a leading, selected "current" option so nothing is lost.
  const currentMode = info.keyMode ?? 'major';
  const currentKeyValue =
    info.keyFifths != null ? `${info.keyFifths}:${currentMode}` : '';
  const isListedKey = currentMode === 'major' || currentMode === 'minor';

  // Tempo is a free-text field committed on blur/Enter. When the live tempo
  // changes from elsewhere (undo/redo, a later transpose, etc.) mirror it back
  // into the field — done by adjusting state during render (React's documented
  // pattern for "reset state when a prop changes"), not an effect.
  const liveTempoText = info.tempo != null ? String(info.tempo) : '';
  const [tempoText, setTempoText] = useState(liveTempoText);
  const [syncedTempo, setSyncedTempo] = useState(info.tempo);
  if (syncedTempo !== info.tempo) {
    setSyncedTempo(info.tempo);
    setTempoText(liveTempoText);
  }

  function handleKeyChange(value: string) {
    const [fifthsText, mode] = value.split(':');
    const fifths = Number.parseInt(fifthsText, 10);
    if (!Number.isNaN(fifths)) onSetKey(fifths, mode);
  }

  function commitTempo() {
    const n = Math.round(Number.parseFloat(tempoText));
    if (Number.isFinite(n) && n >= MIN_BPM && n <= MAX_BPM) {
      if (n !== info.tempo) onSetTempo(n);
    } else {
      // Reject out-of-range / non-numeric: snap back to the live value.
      setTempoText(liveTempoText);
    }
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Global edits">
      <div className="toolbar__group">
        <label className="toolbar__label" htmlFor={keyId}>
          Key
        </label>
        <select
          id={keyId}
          className="toolbar__select"
          value={currentKeyValue}
          disabled={!info.hasKey}
          title={info.hasKey ? undefined : 'This score has no key signature to relabel'}
          onChange={(e) => handleKeyChange(e.target.value)}
        >
          {info.keyFifths == null && (
            <option value="" disabled>
              —
            </option>
          )}
          {!isListedKey && info.keyFifths != null && (
            <option value={currentKeyValue}>{info.key ?? 'Current'}</option>
          )}
          <optgroup label="Major">
            {MAJOR_KEYS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Minor">
            {MINOR_KEYS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__group">
        <span className="toolbar__label">Transpose</span>
        <div className="toolbar__stepper">
          <button
            type="button"
            className="toolbar__step-btn"
            onClick={() => onTranspose(-1)}
            aria-label="Transpose down a semitone"
            title="Transpose down a semitone"
          >
            <Minus size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="toolbar__step-btn"
            onClick={() => onTranspose(1)}
            aria-label="Transpose up a semitone"
            title="Transpose up a semitone"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__group">
        <label className="toolbar__label" htmlFor={tempoId}>
          Tempo
        </label>
        <input
          id={tempoId}
          className="toolbar__tempo"
          type="number"
          inputMode="numeric"
          min={MIN_BPM}
          max={MAX_BPM}
          placeholder="120"
          value={tempoText}
          onChange={(e) => setTempoText(e.target.value)}
          onBlur={commitTempo}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="toolbar__unit">BPM</span>
      </div>
    </div>
  );
}
