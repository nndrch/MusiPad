import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Play, Plus, Trash2, X } from 'lucide-react';
import {
  formatChordSymbol,
  parseChordSymbol,
  parseLeadingRoot,
  type ChordSpec,
} from '../model/chordSymbol';
import './ChordEditor.css';

/** Screen-space rectangle (from getBoundingClientRect) the popover attaches to. */
export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

interface ChordEditorProps {
  mode: 'add' | 'edit';
  /** The pill / ＋ this popover hangs beneath, in screen (fixed) coordinates. */
  anchorRect: AnchorRect;
  /** Current symbol for edit (pre-fills + preselects); '' for add. */
  initialText: string;
  /** Commit: write the chord (Add or Update). Parent dispatches + auditions. */
  onApply: (spec: ChordSpec) => void;
  /** Remove the chord (edit mode only). */
  onRemove: () => void;
  onClose: () => void;
  /** Audition a chord without committing. */
  onPreview: (spec: ChordSpec) => void;
}

const POPOVER_WIDTH = 264;

/**
 * The common qualities the combobox offers for the current root, in playing
 * order (triads → 7ths → 6ths → sus → extensions). The typed field still
 * accepts anything the parser understands (tensions, slash chords, N.C.).
 */
const SUGGESTION_KINDS = [
  'major',
  'minor',
  'dominant',
  'major-seventh',
  'minor-seventh',
  'half-diminished',
  'diminished',
  'diminished-seventh',
  'augmented',
  'major-sixth',
  'minor-sixth',
  'suspended-fourth',
  'suspended-second',
  'dominant-ninth',
  'minor-ninth',
  'major-ninth',
];

/**
 * The chord-editor popover (PRD §6.3, A1, M6a) — an **editable combobox**: one
 * wide field you can type in *or* pick from a dropdown of chord options for the
 * current root, with the current chord checked when editing. Typing filters the
 * list and accepts anything the parser understands (`Em7`, `F#m7b5`, `C/E`,
 * `N.C.`, unicode ♯♭Δ°ø–); clicking an option, or Enter, commits and auditions.
 *
 * Lives in a body portal at `position: fixed` (screen space) so the score's
 * zoom-to-fit transform doesn't scale the controls. Keyboard: ↑/↓ move the
 * highlight, Enter applies (highlighted option or the typed value), Esc closes.
 */
export function ChordEditor({
  mode,
  anchorRect,
  initialText,
  onApply,
  onRemove,
  onClose,
  onPreview,
}: ChordEditorProps) {
  const [text, setText] = useState(initialText);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const spec = useMemo(() => parseChordSymbol(text), [text]);
  const valid = spec !== null;
  const currentText = spec ? formatChordSymbol(spec) : '';

  // Options = the current root's common qualities, filtered by the typed text.
  const options = useMemo(() => {
    const root = parseLeadingRoot(text) ??
      parseLeadingRoot(initialText) ?? { rootStep: 'C', rootAlter: 0 };
    const all = SUGGESTION_KINDS.map((kind) => {
      const optSpec: ChordSpec = {
        rootStep: root.rootStep,
        rootAlter: root.rootAlter,
        kind,
      };
      return { spec: optSpec, text: formatChordSymbol(optSpec) };
    });
    const q = text.trim().toLowerCase();
    return q ? all.filter((o) => o.text.toLowerCase().includes(q)) : all;
  }, [text, initialText]);

  // Focus the field on open; pre-select existing text so a retype is one step.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (initialText) input.select();
  }, [initialText]);

  // Dismiss on outside pointerdown / Esc. Chord UI is tagged `data-chord-ui`.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-chord-ui]')) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  // Position beneath the anchor, centered + clamped to the viewport. Pure
  // function of the anchor (the popover doesn't reflow in its short lifetime).
  const pos = useMemo(() => {
    const margin = 8;
    const centered = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
    return {
      left: Math.max(
        margin,
        Math.min(centered, window.innerWidth - POPOVER_WIDTH - margin),
      ),
      top: anchorRect.bottom + 6,
    };
  }, [anchorRect]);

  function commit(s: ChordSpec) {
    onApply(s);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < options.length) commit(options[active].spec);
      else if (spec) commit(spec);
    }
  }

  return createPortal(
    <div
      className="chord-editor"
      data-chord-ui
      role="dialog"
      aria-label={mode === 'add' ? 'Add chord' : 'Edit chord'}
      style={{ left: pos.left, top: pos.top, width: POPOVER_WIDTH }}
    >
      <div className="chord-editor__head">
        <span className="chord-editor__title">
          {mode === 'add' ? 'Add chord' : 'Edit chord'}
        </span>
        <button
          type="button"
          className="chord-editor__icon"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="chord-editor__fieldrow">
        <input
          ref={inputRef}
          type="text"
          className={`chord-editor__field${valid || text === '' ? '' : ' is-invalid'}`}
          value={text}
          placeholder="Type or pick — e.g. Em7, C/E"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
        />
        <button
          type="button"
          className="chord-editor__icon chord-editor__chevron"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          aria-label={open ? 'Hide options' : 'Show options'}
          title={open ? 'Hide options' : 'Show options'}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      </div>

      {open && options.length > 0 && (
        <ul className="chord-editor__list" role="listbox">
          {options.map((o, i) => {
            const isCurrent = o.text === currentText;
            return (
              <li key={o.text}>
                <button
                  type="button"
                  className={`chord-editor__opt${i === active ? ' is-active' : ''}${
                    isCurrent ? ' is-current' : ''
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(o.spec)}
                >
                  <span>{o.text}</span>
                  {isCurrent && <Check size={14} strokeWidth={2.4} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="chord-editor__actions">
        <button
          type="button"
          className="chord-editor__icon"
          onClick={() => spec && onPreview(spec)}
          disabled={!valid}
          aria-label="Hear chord"
          title="Hear chord"
        >
          <Play size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="chord-editor__apply"
          onClick={() => spec && commit(spec)}
          disabled={!valid}
          title={mode === 'add' ? 'Add chord (Enter)' : 'Update chord (Enter)'}
        >
          {mode === 'add' ? (
            <Plus size={15} strokeWidth={2.2} />
          ) : (
            <Check size={15} strokeWidth={2.2} />
          )}
          <span>{mode === 'add' ? 'Add' : 'Update'}</span>
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            className="chord-editor__icon chord-editor__remove"
            onClick={onRemove}
            aria-label="Remove chord"
            title="Remove chord"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
