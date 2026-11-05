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
  /**
   * Top / middle / bottom **staff-line** y in px — read from the staff geometry,
   * so they're independent of bar content (chords, stems). The slash sits on
   * `staffMidY`; the section divider spans `staffTopY`→`staffBottomY`. Fall back
   * to box geometry if the stave isn't exposed.
   */
  staffTopY: number;
  staffMidY: number;
  staffBottomY: number;
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
   * The **middle staff line** y in unscaled px — read from the staff geometry
   * (one value per measure), so it's the same for every beat and independent of
   * chords / stems. The custom `SlashLayer` (M9) centers its slash here, so
   * slashes always sit dead-center on the staff.
   */
  y: number;
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
interface VFStave {
  getYForLine(line: number): number;
  getNumLines?: () => number;
}
interface GMeasure {
  PositionAndShape: BBox;
  /** `Parent` is the `GraphicalMusicPage` the system sits on — used to map a
   *  measure to its page in A4 page mode (M10), where coords reset per page. */
  ParentMusicSystem?: { PositionAndShape: BBox; Parent?: object };
  staffEntries?: { PositionAndShape: BBox }[];
  /**
   * The rendered VexFlow stave (VexFlow backend). Its line geometry is the
   * content-independent source of truth for staff-line y positions.
   */
  stave?: VFStave;
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
 * Top / middle / bottom staff-line y in **px**, read from the rendered VexFlow
 * stave — content-independent. A note's or staff-entry's bounding-box center
 * drifts with chord symbols above the bar and with stems; the staff lines do
 * not. Returns null when the stave isn't exposed (non-VexFlow backend), so
 * callers fall back to box geometry. VexFlow stave coordinates are already in
 * the SVG's px space, so they are used directly (no `× k`).
 */
function staffLinesPx(
  gm: GMeasure,
): { top: number; mid: number; bottom: number } | null {
  const stave = gm.stave;
  if (!stave || typeof stave.getYForLine !== 'function') return null;
  const lines = stave.getNumLines?.() ?? 5;
  const last = Math.max(lines - 1, 0);
  return {
    top: stave.getYForLine(0),
    mid: stave.getYForLine(last / 2),
    bottom: stave.getYForLine(last),
  };
}

/**
 * Map each OSMD `GraphicalMusicPage` object → its 0-based index, so a measure's
 * `ParentMusicSystem.Parent` (the page it lives on) resolves to a page number.
 * Continuous (`Endless`) mode has a single page; A4 page mode (M10) lays the
 * score onto N pages, each rendered as its own `<svg>` with **page-local**
 * coordinates (they reset to ~0 at every page top).
 */
function pageIndexMap(osmd: OpenSheetMusicDisplay): Map<object, number> {
  const pages = (osmd.GraphicSheet?.MusicPages ?? []) as object[];
  const map = new Map<object, number>();
  pages.forEach((p, i) => map.set(p, i));
  return map;
}

/**
 * The unscaled top offset (px) of each rendered page, relative to the first
 * page's top. OSMD emits one `<svg>` per page (M10), each wrapped in a
 * positioned `<div>` (`osmdCanvasPageN`); the measure coordinates are
 * page-local (reset per page), so the overlay adds its page's offset here to
 * land in one unified coordinate space.
 *
 * We read the **wrapper div's** `offsetTop` (a real HTMLElement — `<svg>`
 * doesn't expose `offsetTop`) relative to the first page. These are layout
 * values, so they're immune to the `.osmd-scale` transform AND automatically
 * include whatever inter-sheet gap the CSS adds (no constant to keep in sync).
 * Continuous mode = one page = `[0]`.
 */
function pageTops(svgs: SVGElement[]): number[] {
  if (svgs.length === 0) return [];
  const wrappers = svgs.map((s) => s.parentElement as HTMLElement | null);
  const base = wrappers[0]?.offsetTop ?? 0;
  return wrappers.map((w) => (w?.offsetTop ?? 0) - base);
}

/** The page index a measure sits on (0 when unknown / single-page). */
function pageOfMeasure(gm: GMeasure, pageOf: Map<object, number>): number {
  const page = gm.ParentMusicSystem?.Parent;
  return (page && pageOf.get(page)) ?? 0;
}

/** A rendered A4 page's rectangle, in `.osmd-scale` (unscaled) coordinates. */
export interface PageRect {
  index: number;
  /** Top / left of the sheet relative to `.osmd-scale` (the decorations' box). */
  top: number;
  left: number;
  /** Sheet width / height in px (intrinsic SVG size; A4 portrait in page mode). */
  width: number;
  height: number;
}

/**
 * One rect per rendered page `<svg>` (M10) — used by `OsmdView` to drop the
 * page-1 header and per-page page numbers onto the right sheet. Coordinates are
 * in the same `.osmd-scale` space the decorations are positioned in: the host's
 * content-box origin (its offset within `.osmd-scale`, plus padding) plus each
 * page's `pageTops` offset. Continuous mode returns one rect; empty before the
 * first render.
 */
export function computePageRects(host: HTMLElement | null): PageRect[] {
  if (!host) return [];
  const svgs = [...host.querySelectorAll('svg')] as SVGElement[];
  const tops = pageTops(svgs);
  const cs = getComputedStyle(host);
  const originTop =
    host.offsetTop + host.clientTop + (Number.parseFloat(cs.paddingTop) || 0);
  const originLeft =
    host.offsetLeft + host.clientLeft + (Number.parseFloat(cs.paddingLeft) || 0);
  return svgs.map((svg, i) => ({
    index: i,
    top: originTop + tops[i],
    left: originLeft,
    width: svg.clientWidth,
    height: svg.clientHeight,
  }));
}

/**
 * One rectangle per measure (document order). Horizontal extent comes from the
 * measure's own box; vertical extent from its parent music system, so every bar
 * on a line shares one clean band that includes the chord-symbol row above the
 * staff. In A4 page mode each measure's page offset is added to every y so all
 * pages share one coordinate space (M10). Returns `[]` before the first
 * successful render.
 */
export function computeMeasureBoxes(
  osmd: OpenSheetMusicDisplay,
  host: HTMLElement | null,
): MeasureBox[] {
  const measureList = osmd.GraphicSheet?.MeasureList as
    | GMeasure[][]
    | undefined;
  if (!measureList || measureList.length === 0) return [];

  const svgs = host
    ? ([...host.querySelectorAll('svg')] as SVGElement[])
    : [];
  const k = pxPerUnit(osmd, svgs[0] ?? null);
  const tops = pageTops(svgs);
  const pageOf = pageIndexMap(osmd);
  const boxes: MeasureBox[] = [];

  for (let mi = 0; mi < measureList.length; mi++) {
    const gm = measureList[mi]?.[0]; // first staff of this measure
    if (!gm?.PositionAndShape) continue;

    const dy = tops[pageOfMeasure(gm, pageOf)] ?? 0;

    const { left, width } = boxLeftWidth(gm.PositionAndShape);
    // Prefer the system band (uniform height per line, covers chords above the
    // staff); fall back to the measure's own box.
    const sysBox = gm.ParentMusicSystem?.PositionAndShape;
    const { top, height } = boxTopHeight(sysBox ?? gm.PositionAndShape);

    // Staff lines (content-independent); fall back to the measure's own box.
    const sl = staffLinesPx(gm);
    const own = boxTopHeight(gm.PositionAndShape);
    const ownBottom = boxBottom(gm.PositionAndShape);

    boxes.push({
      measureIndex: mi,
      x: left * k,
      y: top * k + dy,
      width: width * k,
      height: height * k,
      staffTopY: (sl ? sl.top : own.top * k) + dy,
      staffMidY: (sl ? sl.mid : ((own.top + ownBottom) / 2) * k) + dy,
      staffBottomY: (sl ? sl.bottom : ownBottom * k) + dy,
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
  host: HTMLElement | null,
): StaffEntryAnchor[] {
  const measureList = osmd.GraphicSheet?.MeasureList as
    | GMeasure[][]
    | undefined;
  if (!measureList || measureList.length === 0) return [];

  const svgs = host
    ? ([...host.querySelectorAll('svg')] as SVGElement[])
    : [];
  const k = pxPerUnit(osmd, svgs[0] ?? null);
  const tops = pageTops(svgs);
  const pageOf = pageIndexMap(osmd);

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
    const dy = tops[pageOfMeasure(gm, pageOf)] ?? 0;
    const ownTop = boxTopHeight(gm.PositionAndShape).top;
    const sys = gm.ParentMusicSystem;
    const rowTop = (sys && systemRowTop.get(sys)) ?? ownTop;
    const bottom = boxBottom(gm.PositionAndShape);
    const entries = gm.staffEntries ?? [];

    // The middle staff line — one value for the whole measure, from the staff
    // geometry, so it's the same for every beat and independent of what each
    // entry holds (a chord above the bar, a stem). That per-entry box content
    // was skewing the slash height before.
    const sl = staffLinesPx(gm);
    const midY = sl ? sl.mid : ((ownTop + bottom) / 2) * k;

    for (let ei = 0; ei < entries.length; ei++) {
      const bb = entries[ei]?.PositionAndShape;
      if (!bb) continue;
      anchors.push({
        measureIndex: mi,
        entryIndex: ei,
        x: bb.AbsolutePosition.x * k,
        y: midY + dy,
        chordRowY: rowTop * k + dy,
        slotBottomY: bottom * k + dy,
      });
    }
  }

  return anchors;
}
