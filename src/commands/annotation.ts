/**
 * Annotation commands (PRD §8, §9 M7): add, edit, remove, and move a free-text
 * **annotation** — a plain `<words>` direction above a bar — all undoable via
 * the command layer (Invariant #3).
 *
 * DOM (guidelines §Directions):
 *   `<direction placement="above"><direction-type><words>TEXT</words></direction-type></direction>`
 * Mirrors `section.ts` exactly, with `<words>` instead of `<rehearsal>` (no
 * enclosure — "box = section, plain text = annotation", B7.3).
 *
 * The **feel/style** chip is also a `<words>` direction (the first one in
 * measure 1), but it's a topbar chip, not an annotation. So the annotation
 * locator skips it (via the shared `feelWordsDirection`), and a new annotation
 * in measure 1 is inserted **after** the feel direction so the feel stays the
 * first `<words>` — keeping `scoreInfo`/`buildRenderDoc` and this layer in
 * agreement.
 *
 * Unit of edit is the **measure** (one annotation per measure). Add/edit/remove
 * snapshot just that measure; **move** snapshots the whole part (two measures),
 * like `transpose`.
 */

import { type Command, editElement } from './Command';
import { feelWordsDirection, isAnnotation, tagAnnotation } from '../model/directions';

/** `measureIndex`-th `<measure>` in the primary part, or null. */
function nthMeasure(doc: Document, measureIndex: number): Element | null {
  const part = doc.querySelector('part');
  if (!part) return null;
  return part.querySelectorAll(':scope > measure')[measureIndex] ?? null;
}

/**
 * The MusiPad annotation `<direction>` in a measure, or null. Matches only our
 * tagged directions, so the feel chip and any pre-existing `<words>` (e.g.
 * "D.C. al Coda", which often carries a `<sound>` jump) are never touched.
 */
function annotationDirection(measure: Element): Element | null {
  for (const dir of measure.querySelectorAll(':scope > direction')) {
    if (isAnnotation(dir) && dir.querySelector('direction-type > words')) return dir;
  }
  return null;
}

/** Build a tagged, plain free-text annotation direction. */
function makeAnnotationDirection(doc: Document, text: string): Element {
  const words = doc.createElement('words');
  words.textContent = text;
  const directionType = doc.createElement('direction-type');
  directionType.appendChild(words);
  const direction = doc.createElement('direction');
  direction.setAttribute('placement', 'above');
  direction.appendChild(directionType);
  tagAnnotation(direction);
  return direction;
}

/**
 * Insert an annotation direction. In the measure that holds the feel chip,
 * place it right after the feel so the feel remains the first `<words>`;
 * otherwise after `<attributes>` (else at the top).
 */
function insertAnnotation(measure: Element, direction: Element): void {
  const feel = feelWordsDirection(measure.ownerDocument);
  if (feel && feel.parentElement === measure) {
    feel.after(direction);
    return;
  }
  const attributes = measure.querySelector(':scope > attributes');
  if (attributes) attributes.after(direction);
  else measure.prepend(direction);
}

/**
 * Surgically remove an annotation's `<words>` and prune now-empty ancestors,
 * leaving unrelated siblings intact (Invariant #2). The `<direction>` is only
 * removed when nothing else remains in it (e.g. never strip a co-located
 * `<sound>` jump) — though our tagged annotations never carry one.
 */
function removeWords(direction: Element): void {
  const words = direction.querySelector('direction-type > words');
  if (!words) return;
  const directionType = words.parentElement;
  words.remove();
  if (directionType && directionType.children.length === 0) directionType.remove();
  if (direction.children.length === 0) direction.remove();
}

/** Add an annotation at a bar (no-op if one already exists there). */
export function addAnnotation(measureIndex: number, text: string): Command {
  return editElement(
    `Add annotation at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      if (annotationDirection(measure)) return; // one annotation per measure
      insertAnnotation(measure, makeAnnotationDirection(measure.ownerDocument, text));
    },
  );
}

/** Edit the annotation text at a bar. */
export function editAnnotation(measureIndex: number, text: string): Command {
  return editElement(
    `Edit annotation at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const words = annotationDirection(measure)?.querySelector(
        'direction-type > words',
      );
      if (words) words.textContent = text;
    },
  );
}

/** Remove the annotation at a bar (no-op if none). */
export function removeAnnotation(measureIndex: number): Command {
  return editElement(
    `Remove annotation at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const direction = annotationDirection(measure);
      if (direction) removeWords(direction);
    },
  );
}

/**
 * Move the annotation from one bar to another (snap-to-bar drop, A7). No-op if
 * the source has no annotation or the target already has one. Snapshots the
 * whole part so undo restores both measures.
 */
export function moveAnnotation(fromIndex: number, toIndex: number): Command {
  return editElement(
    `Move annotation ${fromIndex + 1} → ${toIndex + 1}`,
    (doc) => doc.querySelector('part'),
    (part) => {
      const measures = part.querySelectorAll(':scope > measure');
      const from = measures[fromIndex];
      const to = measures[toIndex];
      if (!from || !to || from === to) return;
      const direction = annotationDirection(from);
      if (!direction || annotationDirection(to)) return;
      const moved = direction.cloneNode(true) as Element;
      direction.remove();
      insertAnnotation(to, moved);
    },
  );
}
