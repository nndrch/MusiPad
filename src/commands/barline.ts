/**
 * Section-start barline helpers (PRD §6.5, §9 M9). A bar that begins a section
 * opens with a **double barline** — the chord-chart convention for "a new
 * section starts here":
 *   `<barline location="left"><bar-style>light-light</bar-style></barline>`
 *
 * These are plain, idempotent DOM helpers (not Commands). They run inside the
 * section commands' `editElement` mutate callbacks — so undo is already covered
 * by that command's measure/part snapshot — and inside the load-time
 * `normalizeSectionBarlines` pass.
 *
 * Road-map safety (guidelines §Road map): a chart may already carry a left
 * barline that means something else — a repeat-start (`<repeat direction="forward">`)
 * or a `heavy-light` open. We never clobber those: insert only when there is
 * **no** left barline at all, and remove only our own `light-light` one.
 */

const LEFT = 'left';
const DOUBLE = 'light-light';

/** The left `<barline>` of a measure (any style), or null. */
function leftBarline(measure: Element): Element | null {
  for (const bar of measure.querySelectorAll(':scope > barline')) {
    if (bar.getAttribute('location') === LEFT) return bar;
  }
  return null;
}

/** Whether a measure opens with our section-start double barline. */
export function hasLeftDoubleBarline(measure: Element): boolean {
  const bar = leftBarline(measure);
  return (
    !!bar &&
    bar.querySelector(':scope > bar-style')?.textContent?.trim() === DOUBLE
  );
}

/** Build `<barline location="left"><bar-style>light-light</bar-style></barline>`. */
export function makeLeftDoubleBarline(doc: Document): Element {
  const barline = doc.createElement('barline');
  barline.setAttribute('location', LEFT);
  const style = doc.createElement('bar-style');
  style.textContent = DOUBLE;
  barline.appendChild(style);
  return barline;
}

/**
 * Open a measure with the section-start double barline (its first child).
 * Idempotent and road-map-safe: a no-op if the measure already has *any* left
 * barline, so a repeat-start or other opening barline is never clobbered.
 */
export function insertLeftDoubleBarline(measure: Element): void {
  if (leftBarline(measure)) return;
  measure.prepend(makeLeftDoubleBarline(measure.ownerDocument));
}

/** Remove only our own section-start double barline (leaves repeats/others). */
export function removeLeftDoubleBarline(measure: Element): void {
  if (hasLeftDoubleBarline(measure)) leftBarline(measure)!.remove();
}
