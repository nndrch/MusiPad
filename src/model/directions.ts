/**
 * Readers for the two M7 chart-authoring marks that live as MusicXML
 * `<direction>`s above the staff (PRD §8, §9 M7):
 *   • **Section** — a boxed rehearsal mark:
 *     `<direction placement="above"><direction-type><rehearsal enclosure="square">LABEL</rehearsal></direction-type></direction>`
 *   • **Annotation** — plain free text:
 *     `<direction placement="above"><direction-type><words>TEXT</words></direction-type></direction>`
 *
 * Both are addressed by `measureIndex` (one of each per measure — matches the
 * snap-to-bar drag model, A7). The overlay layers read these to render their
 * HTML pills/text, mirroring how `readChartChords` feeds `ChordLayer`.
 *
 * MusiPad-authored annotations carry a `data-musipad="annotation"` marker
 * (`tagAnnotation`) so they're identified by **persisted content, not document
 * position**. This matters because the **feel/style** marking (Berklee
 * convention) is *also* a `<words>` direction — the first plain `<words>` in
 * measure 1, surfaced as a topbar chip. Defining the feel positionally alone is
 * fragile: on a chart with no feel, an annotation added to bar 1 (the default
 * target) would become the "first `<words>`" and be mistaken for the feel —
 * swallowed from the overlay, hijacking the topbar, lost across reload. The
 * marker fixes that for good: an annotation is *the tagged direction*; the feel
 * is *the first untagged `<words>` in measure 1*. Untagged, non-feel `<words>`
 * a file already had (e.g. "D.C. al Coda", expression text) are left alone —
 * not treated as annotations and rendered natively by OSMD (guidelines §80).
 * The marker only ever lands on directions the user creates, so unedited
 * content stays byte-identical (Invariant #2).
 */

/** Attribute marking a MusiPad-authored free-text annotation direction. */
const MARK_ATTR = 'data-musipad';

/** Tag a `<direction>` as a MusiPad annotation (survives serialization). */
export function tagAnnotation(direction: Element): void {
  direction.setAttribute(MARK_ATTR, 'annotation');
}

/** Whether a `<direction>` is a MusiPad-authored annotation. */
export function isAnnotation(direction: Element): boolean {
  return direction.getAttribute(MARK_ATTR) === 'annotation';
}

export interface SectionMark {
  measureIndex: number;
  label: string;
}

export interface AnnotationMark {
  measureIndex: number;
  text: string;
}

/**
 * The `<direction>` of the feel/style chip — the first **untagged** `<words>`
 * direction in measure 1 of the primary part — or null. Shared by
 * `scoreInfo.readStyle` (reads its text) and `useOsmd.buildRenderDoc` (strips
 * it from the render clone). Skips MusiPad annotations so a user annotation in
 * measure 1 is never mistaken for the feel.
 */
export function feelWordsDirection(doc: Document): Element | null {
  const firstMeasure = doc.querySelector('part > measure');
  if (!firstMeasure) return null;
  for (const dir of firstMeasure.querySelectorAll(':scope > direction')) {
    if (isAnnotation(dir)) continue;
    if (dir.querySelector('direction-type > words')) return dir;
  }
  return null;
}

/** Every section (rehearsal) mark in the chart, keyed by measure (first per measure). */
export function readChartSections(doc: Document): SectionMark[] {
  const part = doc.querySelector('part');
  if (!part) return [];
  const out: SectionMark[] = [];
  part.querySelectorAll(':scope > measure').forEach((measure, measureIndex) => {
    for (const dir of measure.querySelectorAll(':scope > direction')) {
      const reh = dir.querySelector('direction-type > rehearsal');
      if (reh) {
        out.push({ measureIndex, label: reh.textContent ?? '' });
        break; // one section per measure
      }
    }
  });
  return out;
}

/**
 * Every MusiPad-authored annotation in the chart, keyed by measure (first per
 * measure). Only tagged directions count — the feel chip and any pre-existing
 * non-annotation `<words>` (e.g. "D.C. al Coda") are deliberately excluded.
 */
export function readChartAnnotations(doc: Document): AnnotationMark[] {
  const part = doc.querySelector('part');
  if (!part) return [];
  const out: AnnotationMark[] = [];
  part.querySelectorAll(':scope > measure').forEach((measure, measureIndex) => {
    for (const dir of measure.querySelectorAll(':scope > direction')) {
      if (!isAnnotation(dir)) continue;
      const words = dir.querySelector('direction-type > words');
      if (words) {
        out.push({ measureIndex, text: words.textContent ?? '' });
        break; // one annotation per measure
      }
    }
  });
  return out;
}

/**
 * The first measure index in the primary part **not** present in `occupied`, or
 * null if every bar is occupied. Used to auto-place a new section/annotation on
 * the first free bar when no bar is selected, so a toolbar add never overwrites
 * an existing mark (M7, B7.2/B7.3). Pass the measure indices already carrying
 * that kind of mark (from `readChartSections` / `readChartAnnotations`).
 */
export function firstFreeMeasure(
  doc: Document,
  occupied: Iterable<number>,
): number | null {
  const part = doc.querySelector('part');
  if (!part) return null;
  const total = part.querySelectorAll(':scope > measure').length;
  const taken = new Set(occupied);
  for (let i = 0; i < total; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}
