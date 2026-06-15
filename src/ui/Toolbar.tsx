import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { keyLabel, type ScoreInfo } from '../model/scoreInfo';
import './Toolbar.css';

// Tempo bounds for the input (quarter-notes/min). Generous but sane.
const MIN_BPM = 20;
const MAX_BPM = 400;

/** Common section labels offered by the ＋Section menu (B7.2); "Custom…" adds the rest. */
const SECTION_PRESETS = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Outro'];

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

/** Meter options (B8.2): common numerators and denominators for lead sheets. */
const METER_BEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const METER_BEAT_TYPES = [2, 4, 8, 16];

interface ToolbarProps {
  info: ScoreInfo;
  /** Relabel the key signature (no pitch change). */
  onSetKey: (fifths: number, mode: string) => void;
  /** Transpose the whole chart by ±1 semitone (pitches + key + chords). */
  onTranspose: (semitones: number) => void;
  /** Set the initial tempo (BPM); drives playback. */
  onSetTempo: (bpm: number) => void;
  /** Set the chart's time signature (beats / beat-type); reflows the slash grid. */
  onSetMeter: (beats: number, beatType: number) => void;
  /** Add (or relabel) a section mark at the target bar (M7). */
  onAddSection: (label: string) => void;
  /** Add an empty annotation at the target bar, then open its inline editor (M7). */
  onAddAnnotation: () => void;
}

/**
 * Global-edit toolbar (PRD §6.2, M4/M7): Key relabel ▾, Transpose ±, Tempo
 * input, and the M7 ＋Section / ＋Note authoring controls. Quiet and inline per
 * the design language (§6.1). Each control's change dispatches an undoable
 * command via App.
 */
export function Toolbar({
  info,
  onSetKey,
  onTranspose,
  onSetTempo,
  onSetMeter,
  onAddSection,
  onAddAnnotation,
}: ToolbarProps) {
  const keyId = useId();
  const tempoId = useId();
  const meterId = useId();

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

  // Meter (M8). The two selects are controlled by the live DOM reading (like
  // Key); an unlisted current value is surfaced as a leading option so it shows.
  const beatsListed =
    info.meterBeats != null && METER_BEATS.includes(info.meterBeats);
  const typeListed =
    info.meterBeatType != null && METER_BEAT_TYPES.includes(info.meterBeatType);

  function handleBeatsChange(value: string) {
    const beats = Number.parseInt(value, 10);
    if (!Number.isNaN(beats) && beats !== info.meterBeats) {
      onSetMeter(beats, info.meterBeatType ?? 4);
    }
  }
  function handleBeatTypeChange(value: string) {
    const beatType = Number.parseInt(value, 10);
    if (!Number.isNaN(beatType) && beatType !== info.meterBeatType) {
      onSetMeter(info.meterBeats ?? 4, beatType);
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

      <div className="toolbar__divider" />

      <div className="toolbar__group">
        <label className="toolbar__label" htmlFor={meterId}>
          Meter
        </label>
        <div className="toolbar__meter">
          <select
            id={meterId}
            className="toolbar__select toolbar__meter-select"
            value={info.meterBeats ?? ''}
            disabled={!info.hasMeter}
            title={
              info.hasMeter ? 'Beats per bar' : 'This score has no time signature'
            }
            aria-label="Beats per bar"
            onChange={(e) => handleBeatsChange(e.target.value)}
          >
            {info.meterBeats == null && (
              <option value="" disabled>
                —
              </option>
            )}
            {!beatsListed && info.meterBeats != null && (
              <option value={info.meterBeats}>{info.meterBeats}</option>
            )}
            {METER_BEATS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="toolbar__meter-slash" aria-hidden="true">
            /
          </span>
          <select
            className="toolbar__select toolbar__meter-select"
            value={info.meterBeatType ?? ''}
            disabled={!info.hasMeter}
            title="Beat unit"
            aria-label="Beat unit"
            onChange={(e) => handleBeatTypeChange(e.target.value)}
          >
            {info.meterBeatType == null && (
              <option value="" disabled>
                —
              </option>
            )}
            {!typeListed && info.meterBeatType != null && (
              <option value={info.meterBeatType}>{info.meterBeatType}</option>
            )}
            {METER_BEAT_TYPES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="toolbar__divider" />

      <MarkControls
        onAddSection={onAddSection}
        onAddAnnotation={onAddAnnotation}
      />
    </div>
  );
}

/**
 * ＋Section (preset menu + Custom… inline) and ＋Note controls (M7, B7.2/B7.3).
 * Both drop their mark on the target bar (App picks selected-else-first). The
 * menu dismisses on outside-pointerdown / Esc, mirroring the ChordEditor
 * convention; "Custom…" swaps the preset list for an inline label input.
 */
function MarkControls({
  onAddSection,
  onAddAnnotation,
}: {
  onAddSection: (label: string) => void;
  onAddAnnotation: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setCustom(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (custom) customRef.current?.focus();
  }, [custom]);

  function pick(label: string) {
    onAddSection(label);
    close();
  }

  return (
    <div className="toolbar__marks" ref={rootRef}>
      <button
        type="button"
        className="toolbar__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setCustom(false);
          setOpen((o) => !o);
        }}
      >
        <Plus size={14} strokeWidth={2.2} />
        Section
        <ChevronDown size={13} strokeWidth={2} />
      </button>
      <button type="button" className="toolbar__btn" onClick={onAddAnnotation}>
        <Plus size={14} strokeWidth={2.2} />
        Note
      </button>

      {open && (
        <div className="toolbar__menu" role="menu">
          {!custom ? (
            <>
              {SECTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="menuitem"
                  className="toolbar__menu-item"
                  onClick={() => pick(preset)}
                >
                  {preset}
                </button>
              ))}
              <div className="toolbar__menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="toolbar__menu-item"
                onClick={() => setCustom(true)}
              >
                Custom…
              </button>
            </>
          ) : (
            <input
              ref={customRef}
              className="toolbar__menu-input"
              placeholder="Section label"
              aria-label="Custom section label"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value) pick(value);
                  else close();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  close();
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
