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

/**
 * A single graphical note onset (staff entry) within a measure — the anchor for
 * a chord pill / ＋ / slash target (M6). Derived from OSMD's laid-out note
 * graphics (not a linear division), so it sits exactly over the slash/note.
 * `entryIndex` is the 0-based ordinal of the *sounding* note in the measure,
 * matching `commands/chord.ts`'s note addressing (chord-member notes share an
 * entry and don't advance it).
 */
export interface StaffEntryAnchor {
  measureIndex: number;
  entryIndex: number;
  /** Anchor x in unscaled px — the notehead position. */
  x: number;
  /**
   * Chord-row top in px — where a pill / ＋ sits. **Uniform per system**: the
   * highest measure-box top on the line, so a chord in any bar defines the row
   * for the whole line. (OSMD only reserves chord-row space above bars that
   * actually have a chord, so a chord-less bar's own box top would sit at the
   * staff — using the per-system row keeps the ＋ aligned with neighbouring
   * pills.)
   */
  chordRowY: number;
  /** Bottom of this note's measure box in px — the slash hit zone runs to here. */
  slotBottomY: number;
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
  staffEntries?: { PositionAndShape: BBox }[];
}

/** Bottom edge of a bounding box, in units. */
function boxBottom(bb: BBox): number {
  return bb.AbsolutePosition.y + bb.BorderBottom;
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
 * One anchor per graphical note onset, in document order, across all measures
 * (M6). Each carries the notehead x and its measure's staff band, so the chord
 * layer can place a pill / ＋ over the right slash and a hit target on it. x
 * comes from OSMD's actual note graphics — accurate across the clef/key/time
 * indent of bar 1 and OSMD's non-linear spacing, unlike a linear beat division.
 * The `entryIndex` aligns with `commands/chord.ts` note addressing. Returns `[]`
 * before the first successful render.
 */
export function computeStaffEntries(
  osmd: OpenSheetMusicDisplay,
  svg: SVGElement | null,
): StaffEntryAnchor[] {
  const measureList = osmd.GraphicSheet?.MeasureList as
    | GMeasure[][]
    | undefined;
  if (!measureList || measureList.length === 0) return [];

  const k = pxPerUnit(osmd, svg);

  // Pass 1 — the chord row for each system (= the highest measure-box top on
  // the line). A bar with a chord has its box top raised to include the chord
  // row; a chord-less bar's top sits at the staff. Taking the min-top per
  // system gives one chord-row baseline so the ＋ aligns with the line's pills.
  const systemRowTop = new Map<object, number>();
  for (const row of measureList) {
    const gm = row?.[0];
    const sys = gm?.ParentMusicSystem;
    if (!gm?.PositionAndShape || !sys) continue;
    const top = boxTopHeight(gm.PositionAndShape).top;
    const prev = systemRowTop.get(sys);
    if (prev === undefined || top < prev) systemRowTop.set(sys, top);
  }

  // Pass 2 — one anchor per note onset.
  const anchors: StaffEntryAnchor[] = [];
  for (let mi = 0; mi < measureList.length; mi++) {
    const gm = measureList[mi]?.[0];
    if (!gm?.PositionAndShape) continue;
    const ownTop = boxTopHeight(gm.PositionAndShape).top;
    const sys = gm.ParentMusicSystem;
    const rowTop = (sys && systemRowTop.get(sys)) ?? ownTop;
    const bottom = boxBottom(gm.PositionAndShape);
    const entries = gm.staffEntries ?? [];

    for (let ei = 0; ei < entries.length; ei++) {
      const bb = entries[ei]?.PositionAndShape;
      if (!bb) continue;
      anchors.push({
        measureIndex: mi,
        entryIndex: ei,
        x: bb.AbsolutePosition.x * k,
        chordRowY: rowTop * k,
        slotBottomY: bottom * k,
      });
    }
  }

  return anchors;
}
