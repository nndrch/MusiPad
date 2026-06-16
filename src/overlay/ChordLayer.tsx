import {
  memo,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
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
  /** Move a chord onto another beat, snapping to the nearest slash (M11). */
  onMoveChord: (
    fromMeasure: number,
    fromEntry: number,
    toMeasure: number,
    toEntry: number,
  ) => void;
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

/** In-flight chord-pill drag (M11) — mirrors `MarkLayer`'s drag-to-snap. */
interface DragState {
  from: Coord;
  /** The beat anchor nearest the pointer (the snap target). */
  target: Coord;
  /** Layer scale (screen px per unscaled px) captured at drag start. */
  scale: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** Becomes true once the pointer passes the drag threshold (vs a click). */
  moved: boolean;
}

/** Unscaled px: width of the per-slash hover zone over a notehead. */
const SLOT_W = 22;
/** Pointer travel (screen px) that turns a pill press into a drag, not a click. */
const DRAG_THRESHOLD = 4;

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
  onMoveChord,
}: ChordLayerProps) {
  const { entries, frame } = useMeasureBoxes(osmdRef, hostRef, renderSignal);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

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

  // ── Drag-to-reorder (M11) ──────────────────────────────────────────────────
  // A pill drags onto another beat, snapping to the nearest slash anchor; a
  // short press (under the threshold) is still a click that opens the editor.
  // Mirrors `MarkLayer`'s pointer-capture flow; screen↔unscaled is handled via
  // the layer's live rect-vs-frame scale, so it's correct in both view modes.

  /** The beat anchor nearest a screen point — the snap target while dragging. */
  function anchorAtPoint(cx: number, cy: number): Coord | null {
    const layer = layerRef.current;
    if (!layer || !frame) return null;
    const r = layer.getBoundingClientRect();
    const scale = frame.width > 0 ? r.width / frame.width : 1;
    let best: Coord | null = null;
    let bestDist = Infinity;
    for (const a of entries) {
      const ddx = cx - (r.left + a.x * scale);
      const ddy = cy - (r.top + a.y * scale);
      const d = ddx * ddx + ddy * ddy;
      if (d < bestDist) {
        bestDist = d;
        best = { measureIndex: a.measureIndex, entryIndex: a.entryIndex };
      }
    }
    return best;
  }

  function startPillDrag(e: ReactPointerEvent<HTMLButtonElement>, from: Coord) {
    if (isPlaying || editor) return;
    e.stopPropagation();
    const layer = layerRef.current;
    const scale =
      layer && frame && frame.width > 0
        ? layer.getBoundingClientRect().width / frame.width
        : 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      from,
      target: from,
      scale,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    });
  }

  function movePillDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    const target = anchorAtPoint(e.clientX, e.clientY) ?? drag.target;
    setDrag({ ...drag, dx, dy, moved, target });
  }

  function endPillDrag(e: ReactPointerEvent<HTMLButtonElement>, chordText: string) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const { from, target, moved } = drag;
    setDrag(null);
    if (!moved) {
      // A plain click (no drag) opens the editor on this chord.
      setEditor({
        ...from,
        mode: 'edit',
        initialText: chordText,
        anchorRect: rectOf(e.currentTarget),
      });
      return;
    }
    if (
      target.measureIndex !== from.measureIndex ||
      target.entryIndex !== from.entryIndex
    ) {
      onMoveChord(
        from.measureIndex,
        from.entryIndex,
        target.measureIndex,
        target.entryIndex,
      );
    }
  }

  // The slash slot to highlight as the drop target while dragging.
  const dropAnchor =
    drag?.moved &&
    entries.find(
      (a) =>
        a.measureIndex === drag.target.measureIndex &&
        a.entryIndex === drag.target.entryIndex,
    );

  return (
    <>
      <div
        ref={layerRef}
        className={`chord-layer${isPlaying ? ' is-playing' : ''}`}
        style={{
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
        }}
      >
        {dropAnchor && (
          <div
            className="chord-drop"
            style={{
              left: dropAnchor.x - SLOT_W / 2,
              top: dropAnchor.chordRowY,
              width: SLOT_W,
              height: Math.max(dropAnchor.slotBottomY - dropAnchor.chordRowY, 0),
            }}
          />
        )}
        {entries.map((a) => {
          const coord: Coord = {
            measureIndex: a.measureIndex,
            entryIndex: a.entryIndex,
          };
          const chord = chordByKey.get(`${a.measureIndex}:${a.entryIndex}`);

          // Existing chord → a pill: click opens the editor, drag moves it onto
          // another beat (snap to the nearest slash). A drag threshold keeps the
          // two apart (M11).
          if (chord) {
            const isDraggingThis =
              !!drag?.moved &&
              drag.from.measureIndex === a.measureIndex &&
              drag.from.entryIndex === a.entryIndex;
            return (
              <button
                key={`${a.measureIndex}:${a.entryIndex}`}
                type="button"
                data-chord-ui
                data-measure={a.measureIndex}
                data-entry={a.entryIndex}
                className={`chord-pill${isEditingAt(a) ? ' is-active' : ''}${isDraggingThis ? ' is-dragging' : ''}`}
                style={{
                  left: a.x,
                  top: a.chordRowY,
                  // Keep the pill's -50% x-centering (CSS) while following the
                  // pointer; inline transform overrides the stylesheet's.
                  transform: isDraggingThis
                    ? `translate(-50%, 0) translate(${drag.dx / drag.scale}px, ${drag.dy / drag.scale}px)`
                    : undefined,
                }}
                onPointerDown={(e) => startPillDrag(e, coord)}
                onPointerMove={movePillDrag}
                onPointerUp={(e) => endPillDrag(e, chord.text)}
                onClick={(e) => e.stopPropagation()}
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
