import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { X } from 'lucide-react';
import {
  readChartAnnotations,
  readChartSections,
} from '../model/directions';
import { useMeasureBoxes } from './useMeasureBoxes';
import type { MeasureBox } from './projector';
import './MarkLayer.css';

export type MarkVariant = 'section' | 'annotation';

interface MarkLayerProps {
  variant: MarkVariant;
  osmdRef: RefObject<OpenSheetMusicDisplay | null>;
  hostRef: RefObject<HTMLElement | null>;
  /** Bumps once per OSMD render so anchors recompute (M5/M6). */
  renderSignal: number;
  /** Source of truth — read the marks (Invariant #1). */
  doc: Document;
  /** Bumps on every command edit so we re-read the (in-place-mutated) DOM. */
  revision: number;
  /** Editing affordances are hidden while playing (the chart is display-only). */
  isPlaying: boolean;
  /** Selected bar — its mark is highlighted too (B7.7). */
  selectedMeasure: number | null;
  /** Commit a label/text change (rename / edit). */
  onEdit: (measureIndex: number, value: string) => void;
  /** Remove the mark at a bar. */
  onRemove: (measureIndex: number) => void;
  /** Move the mark from one bar to another (snap-to-bar drop). */
  onMove: (fromIndex: number, toIndex: number) => void;
  /** A bar whose mark editor should auto-open (after a toolbar add), or null. */
  pendingEdit: number | null;
  /** Called once the pending editor has been opened. */
  onPendingEditConsumed: () => void;
}

interface DragState {
  from: number;
  target: number;
  dx: number;
  dy: number;
  scale: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/** Movement (px) before a pointer-drag counts as a move rather than a click. */
const DRAG_THRESHOLD = 4;

/** Small inset from the bar's left edge (unscaled px). */
const LEFT_PAD = 2;

/**
 * Vertical rhythm for the marks stacked above the chord row (unscaled px; the
 * system-band top ≈ the chord row, so a negative offset clears the chords and
 * staff). Marks are **stackable, not slotted**: a lone mark — section *or*
 * annotation — sits in the base row just above the chords and reserves no empty
 * row for the other kind. Only a measure carrying BOTH stacks them: annotation
 * in the base row, section one row higher (rehearsal convention = on top). OSMD
 * reserves the headroom for the worst (two-row) case (see `useOsmd` spacing
 * rules). Tuned live.
 */
const BASE_OFFSET = -24;
const ROW_HEIGHT = 22;

/**
 * Generic overlay layer for the two M7 chart-authoring marks (PRD §9 M7):
 *   • `variant="section"` — boxed rehearsal pills (`<rehearsal>`).
 *   • `variant="annotation"` — plain free-text (`<words>`).
 * Both read from the DOM (Invariant #1), render their own HTML over OSMD's SVG
 * (OSMD's native marks are stripped from the render clone, `useOsmd`), and edit
 * through the command layer (undoable, Invariant #3). Mirrors `ChordLayer`:
 * lives inside `.osmd-scale` (rides the zoom transform), click-through except
 * for its own items, hidden affordances while playing.
 *
 * Interactions (ui-decisions A5/A7/B7.7): hover → accent; click → inline
 * edit-in-place (Enter commit / Esc cancel / blur commit; empty → remove);
 * drag the pill → snap to the nearest bar on drop; × → remove. Pixels are never
 * persisted — every mark re-projects from its `measureIndex` each render
 * (Invariant #4).
 */
export const MarkLayer = memo(function MarkLayer({
  variant,
  osmdRef,
  hostRef,
  renderSignal,
  doc,
  revision,
  isPlaying,
  selectedMeasure,
  onEdit,
  onRemove,
  onMove,
  pendingEdit,
  onPendingEditConsumed,
}: MarkLayerProps) {
  const { boxes, frame } = useMeasureBoxes(osmdRef, hostRef, renderSignal);
  const layerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set true once Enter/Esc has handled the edit, so the unmount-triggered blur
  // doesn't commit a second time (or override an Esc cancel).
  const editHandledRef = useRef(false);
  const [editing, setEditing] = useState<{ measureIndex: number; original: string } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Re-read marks after every in-place command edit. `doc` keeps its identity
  // across edits (Invariant #1), so `revision` is the recompute trigger even
  // though it isn't read in the body.
  const marks = useMemo(() => {
    const raw =
      variant === 'section' ? readChartSections(doc) : readChartAnnotations(doc);
    return raw.map((m) => ({
      measureIndex: m.measureIndex,
      value: 'label' in m ? m.label : m.text,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, revision, variant]);

  // Stacking input: which measures also carry an annotation. Marks are
  // stackable, not slotted — a section rises above the base row only when its
  // own measure has an annotation beneath it; otherwise it drops to the base
  // row (no empty slot reserved). Only the section layer needs this; the
  // annotation always takes the base row. Read from the same DOM (Invariant #1),
  // recomputed on `revision` like `marks`.
  const annotatedMeasures = useMemo(() => {
    if (variant !== 'section') return null;
    return new Set(readChartAnnotations(doc).map((a) => a.measureIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, revision, variant]);

  const boxByIndex = useMemo(() => {
    const map = new Map<number, MeasureBox>();
    for (const b of boxes) map.set(b.measureIndex, b);
    return map;
  }, [boxes]);

  // Auto-open the editor for a mark just added from the toolbar (＋Note). Only
  // consume once the mark is actually present, so we don't drop the request if
  // it hasn't reached `marks` yet (a later render retries).
  useEffect(() => {
    if (pendingEdit == null) return;
    const mark = marks.find((m) => m.measureIndex === pendingEdit);
    if (!mark) return;
    setEditing({ measureIndex: pendingEdit, original: mark.value });
    onPendingEditConsumed();
  }, [pendingEdit, marks, onPendingEditConsumed]);

  // Focus + select the inline input when editing opens.
  useEffect(() => {
    if (!editing) return;
    editHandledRef.current = false;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  if (!frame || boxes.length === 0) return null;

  /** Which measure index sits under a screen point — containing box first, else nearest center. */
  function measureAtPoint(cx: number, cy: number): number | null {
    const layer = layerRef.current;
    if (!layer || !frame) return null;
    const r = layer.getBoundingClientRect();
    const scale = frame.width > 0 ? r.width / frame.width : 1;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const b of boxes) {
      const sx = r.left + b.x * scale;
      const sy = r.top + b.y * scale;
      const sw = b.width * scale;
      const sh = b.height * scale;
      if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
        return b.measureIndex;
      }
      const ddx = cx - (sx + sw / 2);
      const ddy = cy - (sy + sh / 2);
      const d = ddx * ddx + ddy * ddy;
      if (d < bestDist) {
        bestDist = d;
        best = b.measureIndex;
      }
    }
    return best;
  }

  function startDrag(e: ReactPointerEvent, measureIndex: number) {
    if (isPlaying || editing) return;
    e.stopPropagation();
    const layer = layerRef.current;
    const scale =
      layer && frame && frame.width > 0
        ? layer.getBoundingClientRect().width / frame.width
        : 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      from: measureIndex,
      target: measureIndex,
      dx: 0,
      dy: 0,
      scale,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    });
  }

  function moveDrag(e: ReactPointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    const target = measureAtPoint(e.clientX, e.clientY) ?? drag.target;
    setDrag({ ...drag, dx, dy, moved, target });
  }

  function endDrag(e: ReactPointerEvent) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const { from, target, moved } = drag;
    setDrag(null);
    if (!moved) {
      // A plain click (no drag) opens the inline editor.
      const mark = marks.find((m) => m.measureIndex === from);
      setEditing({ measureIndex: from, original: mark?.value ?? '' });
      return;
    }
    if (target !== from) onMove(from, target);
  }

  function commitEdit(value: string) {
    if (!editing) return;
    const { measureIndex } = editing;
    const trimmed = value.trim();
    setEditing(null);
    if (!trimmed) onRemove(measureIndex);
    else onEdit(measureIndex, trimmed);
  }

  function cancelEdit() {
    if (!editing) return;
    const { measureIndex, original } = editing;
    setEditing(null);
    // A freshly-added (empty) mark that's cancelled should disappear.
    if (!original.trim()) onRemove(measureIndex);
  }

  const dropTarget = drag?.moved ? boxByIndex.get(drag.target) : undefined;

  return (
    <div
      ref={layerRef}
      className={`mark-layer mark-layer--${variant}${isPlaying ? ' is-playing' : ''}`}
      style={{
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }}
    >
      {/* Snap target highlight while dragging (A7). */}
      {dropTarget && (
        <div
          className="mark-drop"
          style={{
            left: dropTarget.x,
            top: dropTarget.y,
            width: dropTarget.width,
            height: dropTarget.height,
          }}
        />
      )}

      {/* M9: section-start double barline — our own divider, derived from section
          presence (so it shows for add *and* move; the OSMD barline is stripped
          from the render clone). Spans the staff lines; first bar exempt. */}
      {variant === 'section' &&
        marks.map((m) => {
          if (m.measureIndex <= 0) return null;
          const box = boxByIndex.get(m.measureIndex);
          if (!box) return null;
          return (
            <div
              key={`divider-${m.measureIndex}`}
              className="mark-divider"
              style={{
                left: box.x,
                top: box.staffTopY,
                height: box.staffBottomY - box.staffTopY,
              }}
            />
          );
        })}

      {marks.map((m) => {
        const box = boxByIndex.get(m.measureIndex);
        if (!box) return null;
        const isEditing = editing?.measureIndex === m.measureIndex;
        const isDragging = drag?.from === m.measureIndex && drag.moved;
        const isSelected = selectedMeasure === m.measureIndex;
        const classes = ['mark', `mark--${variant}`];
        if (isSelected) classes.push('is-selected');
        if (isDragging) classes.push('is-dragging');
        const followTransform =
          isDragging && drag
            ? `translate(${drag.dx / drag.scale}px, ${drag.dy / drag.scale}px)`
            : undefined;
        // Stackable rows: a section rises one row only when this measure also
        // has an annotation under it; every other case sits in the base row.
        const topOffset =
          variant === 'section' && annotatedMeasures?.has(m.measureIndex)
            ? BASE_OFFSET - ROW_HEIGHT
            : BASE_OFFSET;

        return (
          <div
            key={m.measureIndex}
            className={classes.join(' ')}
            data-measure={m.measureIndex}
            style={{
              left: box.x + LEFT_PAD,
              // Clamp so a first-system mark can't render above the score top.
              top: Math.max(box.y + topOffset, 0),
              transform: followTransform,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="mark__input"
                defaultValue={editing.original}
                aria-label={variant === 'section' ? 'Section label' : 'Annotation text'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    editHandledRef.current = true;
                    commitEdit(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    editHandledRef.current = true;
                    cancelEdit();
                  }
                }}
                onBlur={(e) => {
                  if (editHandledRef.current) return;
                  commitEdit(e.currentTarget.value);
                }}
              />
            ) : (
              <>
                <span
                  className="mark__label"
                  role="button"
                  tabIndex={isPlaying ? -1 : 0}
                  title={
                    isPlaying
                      ? undefined
                      : variant === 'section'
                        ? 'Click to rename · drag to move'
                        : 'Click to edit · drag to move'
                  }
                  onPointerDown={(e) => startDrag(e, m.measureIndex)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onClick={(e) => e.stopPropagation()}
                >
                  {m.value || (variant === 'section' ? 'Section' : 'Note')}
                </span>
                {!isPlaying && (
                  <button
                    type="button"
                    className="mark__remove"
                    aria-label={variant === 'section' ? 'Remove section' : 'Remove annotation'}
                    title="Remove"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(m.measureIndex);
                    }}
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});
