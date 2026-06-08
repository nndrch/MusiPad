import { memo, useMemo, useState, type ReactNode, type RefObject } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Plus } from 'lucide-react';
import {
  readChartChords,
  type ChartChord,
  type ChordSpec,
} from '../model/chordSymbol';
import { useMeasureBoxes } from './useMeasureBoxes';
import { ChordEditor, type AnchorRect } from './ChordEditor';
import './ChordLayer.css';

interface ChordLayerProps {
  osmdRef: RefObject<OpenSheetMusicDisplay | null>;
  hostRef: RefObject<HTMLElement | null>;
  /** Bumps once per OSMD render so anchors recompute (M5/M6). */
  renderSignal: number;
  /** Source of truth — read for existing chords (Invariant #1). */
  doc: Document;
  /** Bumps on every command edit so we re-read the (in-place-mutated) DOM. */
  revision: number;
  /** Editing affordances are hidden while playing (the chart is display-only). */
  isPlaying: boolean;
  /** Add or replace the chord on a beat (parent dispatches + auditions). */
  onSetChord: (
    measureIndex: number,
    entryIndex: number,
    spec: ChordSpec,
  ) => void;
  /** Remove the chord on a beat. */
  onRemoveChord: (measureIndex: number, entryIndex: number) => void;
  /** Audition a chord (the editor's Hear button). */
  onPreview: (spec: ChordSpec) => void;
}

interface Coord {
  measureIndex: number;
  entryIndex: number;
}

interface EditorState extends Coord {
  mode: 'add' | 'edit';
  initialText: string;
  anchorRect: AnchorRect;
}

/** Unscaled px: width of the per-slash hover zone over a notehead. */
const SLOT_W = 22;

/**
 * The interactive chord layer over the score (PRD §6.3, M6a). We render our
 * **own HTML chord pills** (OSMD's drawn glyphs are suppressed in `useOsmd`),
 * anchored over the exact slash each `<harmony>` attaches to.
 *
 * Chord editing is kept **separate from note editing** (the latter — slash
 * toggle / note respell — is M7). Two figure-level gestures, both hover-driven:
 *   • **empty slash** → hovering shows a **＋** above the note; click it to
 *     **add** a chord at that beat.
 *   • **existing chord** → the pill **highlights** (accent) on hover; click it to
 *     **edit / remove**.
 * All edits go through the command layer (undoable). While playing this is
 * display-only so bar click-to-seek (M5) and the playhead aren't blocked.
 *
 * Lives inside `.osmd-scale` (rides the zoom transform, like the M5 overlay);
 * the editor popover portals to the body in screen space so it isn't scaled.
 */
export const ChordLayer = memo(function ChordLayer({
  osmdRef,
  hostRef,
  renderSignal,
  doc,
  revision,
  isPlaying,
  onSetChord,
  onRemoveChord,
  onPreview,
}: ChordLayerProps) {
  const { entries, frame } = useMeasureBoxes(osmdRef, hostRef, renderSignal);
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Re-read chords after every in-place command edit (revision bumps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chords = useMemo(() => readChartChords(doc), [doc, revision]);
  const chordByKey = useMemo(() => {
    const map = new Map<string, ChartChord>();
    for (const c of chords) map.set(`${c.measureIndex}:${c.entryIndex}`, c);
    return map;
  }, [chords]);

  if (!frame || entries.length === 0) return null;

  const isEditingAt = (a: Coord) =>
    editor?.measureIndex === a.measureIndex &&
    editor?.entryIndex === a.entryIndex;

  return (
    <>
      <div
        className={`chord-layer${isPlaying ? ' is-playing' : ''}`}
        style={{
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
        }}
      >
        {entries.map((a) => {
          const coord: Coord = {
            measureIndex: a.measureIndex,
            entryIndex: a.entryIndex,
          };
          const chord = chordByKey.get(`${a.measureIndex}:${a.entryIndex}`);

          // Existing chord → a pill that highlights on hover and edits on click.
          if (chord) {
            return (
              <button
                key={`${a.measureIndex}:${a.entryIndex}`}
                type="button"
                data-chord-ui
                data-measure={a.measureIndex}
                data-entry={a.entryIndex}
                className={`chord-pill${isEditingAt(a) ? ' is-active' : ''}`}
                style={{ left: a.x, top: a.chordRowY }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditor({
                    ...coord,
                    mode: 'edit',
                    initialText: chord.text,
                    anchorRect: rectOf(e.currentTarget),
                  });
                }}
              >
                {renderSymbol(chord.text)}
              </button>
            );
          }

          // Empty slash → a hover zone over the note that reveals a ＋ above it.
          if (isPlaying) return null;
          return (
            <div
              key={`${a.measureIndex}:${a.entryIndex}`}
              className="chord-slot"
              data-measure={a.measureIndex}
              data-entry={a.entryIndex}
              style={{
                left: a.x - SLOT_W / 2,
                top: a.chordRowY,
                width: SLOT_W,
                height: Math.max(a.slotBottomY - a.chordRowY, 0),
              }}
            >
              <button
                type="button"
                data-chord-ui
                data-measure={a.measureIndex}
                data-entry={a.entryIndex}
                className="chord-add"
                aria-label="Add chord"
                title="Add chord"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditor({
                    ...coord,
                    mode: 'add',
                    initialText: '',
                    anchorRect: rectOf(e.currentTarget),
                  });
                }}
              >
                <Plus size={14} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}
      </div>

      {editor && (
        <ChordEditor
          mode={editor.mode}
          anchorRect={editor.anchorRect}
          initialText={editor.initialText}
          onApply={(spec) => {
            onSetChord(editor.measureIndex, editor.entryIndex, spec);
            setEditor(null);
          }}
          onRemove={() => {
            onRemoveChord(editor.measureIndex, editor.entryIndex);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
          onPreview={onPreview}
        />
      )}
    </>
  );
});

/** DOMRect → the screen-space anchor the editor needs. */
function rectOf(el: HTMLElement): AnchorRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom, width: r.width };
}

const ACCIDENTALS = new Set(['♯', '♭', '𝄪']);

/**
 * Render a chord symbol, wrapping accidental glyphs (♯ ♭ 𝄪) so CSS can tighten
 * their wide side-bearings in the engraving font — otherwise "E♭mi" reads as
 * "E ♭ mi". Split by code point so the double-sharp surrogate pair stays whole.
 */
function renderSymbol(text: string) {
  const parts: ReactNode[] = [];
  let buf = '';
  Array.from(text).forEach((ch, i) => {
    if (ACCIDENTALS.has(ch)) {
      if (buf) {
        parts.push(buf);
        buf = '';
      }
      parts.push(
        <span key={i} className="chord-pill__acc">
          {ch}
        </span>,
      );
    } else {
      buf += ch;
    }
  });
  if (buf) parts.push(buf);
  return parts;
}
