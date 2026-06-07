/**
 * Overlay projector (PRD §7.4, M5). OSMD renders the score to SVG; editable
 * affordances (selection, playing highlight, and — from M6 — chord anchors)
 * live in an absolutely-positioned HTML layer over that SVG. This module reads
 * OSMD's *graphical* model and turns it into pixel rectangles the overlay can
 * draw.
 *
 * Coordinates are returned in the score's **unscaled** pixel space (the space
 * OSMD laid the SVG out in, at `NATURAL_WIDTH`). The overlay layer is mounted
 * inside `.osmd-scale`, so the same `transform: scale()` that zoom-fits the
 * score also scales these boxes — no per-resize recomputation, and still
 * Invariant #4 compliant (we derive from OSMD graphics on every render, never
 * persisting final pixels).
 *
 * Pixel scale is **self-calibrated** from the rendered SVG width vs the page's
 * width in OSMD units, so we don't depend on OSMD's internal `UnitInPixels`
 * constant (un-typed) or assume a zoom level. A fallback keeps it working if
 * the SVG can't be measured.
 */

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

/** A measure's rectangle in unscaled score pixels. */
export interface MeasureBox {
  /** 0-based index in document order — matches `schedule.measureStartQuarters`. */
  measureIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A beat position within a measure (scaffold for M6 chord anchors). */
export interface BeatAnchor {
  measureIndex: number;
  /** 0-based beat within the measure. */
  beat: number;
  x: number;
  y: number;
}

// Minimal structural views over OSMD's runtime objects (its `.d.ts` doesn't
// expose every field we read, e.g. EngravingRules.UnitInPixels).
interface Pt {
  x: number;
  y: number;
}
interface BBox {
  AbsolutePosition: Pt;
  Size: { width: number; height: number };
  BorderLeft: number;
  BorderRight: number;
  BorderTop: number;
  BorderBottom: number;
}
interface GMeasure {
  PositionAndShape: BBox;
  ParentMusicSystem?: { PositionAndShape: BBox };
}

/**
 * Pixels per OSMD unit. Self-calibrated from the rendered SVG: OSMD sizes the
 * SVG to `pageWidthUnits × UnitInPixels × zoom`, so `svgWidth / pageWidthUnits`
 * recovers the exact factor. Falls back to OSMD's `UnitInPixels` (×zoom) when
 * the SVG isn't measurable yet.
 */
function pxPerUnit(
  osmd: OpenSheetMusicDisplay,
  svg: SVGElement | null,
): number {
  const page = osmd.GraphicSheet?.MusicPages?.[0] as
    | { PositionAndShape?: BBox }
    | undefined;
  const pageWidthUnits = page?.PositionAndShape?.Size?.width;
  const svgWidthPx =
    svg?.clientWidth ||
    Number.parseFloat(svg?.getAttribute('width') ?? '') ||
    NaN;
  if (pageWidthUnits && pageWidthUnits > 0 && Number.isFinite(svgWidthPx)) {
    return svgWidthPx / pageWidthUnits;
  }
  const rules = osmd.EngravingRules as unknown as { UnitInPixels?: number };
  return (rules?.UnitInPixels ?? 10) * (osmd.Zoom || 1);
}

/** Left edge + width of a bounding box, in units (handles negative borders). */
function boxLeftWidth(bb: BBox): { left: number; width: number } {
  return {
    left: bb.AbsolutePosition.x + bb.BorderLeft,
    width: bb.BorderRight - bb.BorderLeft,
  };
}

/** Top edge + height of a bounding box, in units. */
function boxTopHeight(bb: BBox): { top: number; height: number } {
  return {
    top: bb.AbsolutePosition.y + bb.BorderTop,
    height: bb.BorderBottom - bb.BorderTop,
  };
}

/**
 * One rectangle per measure (document order). Horizontal extent comes from the
 * measure's own box; vertical extent from its parent music system, so every bar
 * on a line shares one clean band that includes the chord-symbol row above the
 * staff. Returns `[]` before the first successful render.
 */
export function computeMeasureBoxes(
  osmd: OpenSheetMusicDisplay,
  svg: SVGElement | null,
): MeasureBox[] {
  const measureList = osmd.GraphicSheet?.MeasureList as
    | GMeasure[][]
    | undefined;
  if (!measureList || measureList.length === 0) return [];

  const k = pxPerUnit(osmd, svg);
  const boxes: MeasureBox[] = [];

  for (let mi = 0; mi < measureList.length; mi++) {
    const gm = measureList[mi]?.[0]; // first staff of this measure
    if (!gm?.PositionAndShape) continue;

    const { left, width } = boxLeftWidth(gm.PositionAndShape);
    // Prefer the system band (uniform height per line, covers chords above the
    // staff); fall back to the measure's own box.
    const sysBox = gm.ParentMusicSystem?.PositionAndShape;
    const { top, height } = boxTopHeight(sysBox ?? gm.PositionAndShape);

    boxes.push({
      measureIndex: mi,
      x: left * k,
      y: top * k,
      width: width * k,
      height: height * k,
    });
  }

  return boxes;
}

/**
 * Per-beat anchor positions — invisible scaffolding in M5 (B5.7); M6 renders
 * chord targets on them and may refine x from actual note graphics. Linear
 * division of each measure box by its time-signature beat count for now.
 */
export function computeBeatAnchors(
  osmd: OpenSheetMusicDisplay,
  boxes: MeasureBox[],
): BeatAnchor[] {
  const sources = osmd.Sheet?.SourceMeasures as
    | { ActiveTimeSignature?: { Numerator?: number } }[]
    | undefined;
  const anchors: BeatAnchor[] = [];

  for (const box of boxes) {
    const beats = sources?.[box.measureIndex]?.ActiveTimeSignature?.Numerator;
    const count = beats && beats > 0 ? beats : 4;
    for (let beat = 0; beat < count; beat++) {
      anchors.push({
        measureIndex: box.measureIndex,
        beat,
        x: box.x + (box.width * beat) / count,
        y: box.y,
      });
    }
  }

  return anchors;
}
