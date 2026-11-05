/**
 * Section commands (PRD §8, §9 M7): add, rename, remove, and move a **section
 * mark** — a boxed rehearsal direction above a bar — all undoable via the
 * command layer (Invariant #3).
 *
 * DOM (guidelines §Directions):
 *   `<direction placement="above"><direction-type><rehearsal enclosure="square">LABEL</rehearsal></direction-type></direction>`
 * inserted after `<attributes>` (else at the top of the measure), reusing the
 * `tempo.ts` direction-insertion convention.
 *
 * Unit of edit is the **measure** (one section per measure, keyed by
 * `measureIndex` — matches the snap-to-bar drag model, A7). Add/rename/remove
 * locate that measure, so `editElement` snapshots just it for the inverse — the
 * same robust pattern Chord/Key/Tempo use. **Move** spans two measures, so it
 * locates (and snapshots) the whole primary `<part>`, exactly like `transpose`.
 */

import { type Command, editElement } from './Command';
import { insertLeftDoubleBarline, removeLeftDoubleBarline } from './barline';

/** `measureIndex`-th `<measure>` in the primary part, or null. */
function nthMeasure(doc: Document, measureIndex: number): Element | null {
  const part = doc.querySelector('part');
  if (!part) return null;
  return part.querySelectorAll(':scope > measure')[measureIndex] ?? null;
}

/** First section (rehearsal) `<direction>` in a measure, or null. */
function sectionDirection(measure: Element): Element | null {
  for (const dir of measure.querySelectorAll(':scope > direction')) {
    if (dir.querySelector('direction-type > rehearsal')) return dir;
  }
  return null;
}

/** Build a boxed-rehearsal section direction. */
function makeSectionDirection(doc: Document, label: string): Element {
  const rehearsal = doc.createElement('rehearsal');
  rehearsal.setAttribute('enclosure', 'square');
  rehearsal.textContent = label;
  const directionType = doc.createElement('direction-type');
  directionType.appendChild(rehearsal);
  const direction = doc.createElement('direction');
  direction.setAttribute('placement', 'above');
  direction.appendChild(directionType);
  return direction;
}

/** Insert a measure-level `<direction>` after `<attributes>` (else at the top). */
function insertDirection(measure: Element, direction: Element): void {
  const attributes = measure.querySelector(':scope > attributes');
  if (attributes) attributes.after(direction);
  else measure.prepend(direction);
}

/**
 * Surgically remove a section's `<rehearsal>` and prune now-empty ancestors
 * (`<direction-type>`, then `<direction>`), leaving any unrelated siblings
 * intact (Invariant #2). The `<direction>` is only removed when nothing else
 * remains — so a loaded rehearsal that bundles a `<sound>` segno/coda keeps the
 * jump rather than having it silently destroyed.
 */
function removeRehearsal(direction: Element): void {
  const rehearsal = direction.querySelector('direction-type > rehearsal');
  if (!rehearsal) return;
  const directionType = rehearsal.parentElement;
  rehearsal.remove();
  if (directionType && directionType.children.length === 0) directionType.remove();
  if (direction.children.length === 0) direction.remove();
}

/**
 * Add a section mark at a bar — or relabel the one already there (upsert, so
 * picking a preset for an occupied bar just sets its label). One per measure.
 */
export function addSection(measureIndex: number, label: string): Command {
  return editElement(
    `Set section "${label}" at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const existing = sectionDirection(measure);
      if (existing) {
        const rehearsal = existing.querySelector('direction-type > rehearsal');
        if (rehearsal) rehearsal.textContent = label;
        return;
      }
      insertDirection(measure, makeSectionDirection(measure.ownerDocument, label));
      // A new section opens with a double barline — the chart convention (M9,
      // PRD §6.5). The first bar of the chart is exempt (no leading double bar).
      if (measureIndex > 0) insertLeftDoubleBarline(measure);
    },
  );
}

/** Rename the section mark at a bar. */
export function editSection(measureIndex: number, label: string): Command {
  return editElement(
    `Rename section at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const rehearsal = sectionDirection(measure)?.querySelector(
        'direction-type > rehearsal',
      );
      if (rehearsal) rehearsal.textContent = label;
    },
  );
}

/** Remove the section mark at a bar (no-op if none). */
export function removeSection(measureIndex: number): Command {
  return editElement(
    `Remove section at ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const direction = sectionDirection(measure);
      if (direction) {
        removeRehearsal(direction);
        // Drop the section's double barline too (only ours; repeats untouched).
        if (measureIndex > 0) removeLeftDoubleBarline(measure);
      }
    },
  );
}

/**
 * Move the section mark from one bar to another (snap-to-bar drop, A7). No-op
 * if the source has no section or the target already has one. Snapshots the
 * whole part so undo restores both measures.
 */
export function moveSection(fromIndex: number, toIndex: number): Command {
  return editElement(
    `Move section ${fromIndex + 1} → ${toIndex + 1}`,
    (doc) => doc.querySelector('part'),
    (part) => {
      const measures = part.querySelectorAll(':scope > measure');
      const from = measures[fromIndex];
      const to = measures[toIndex];
      if (!from || !to || from === to) return;
      const direction = sectionDirection(from);
      if (!direction || sectionDirection(to)) return;
      const moved = direction.cloneNode(true) as Element;
      direction.remove();
      insertDirection(to, moved);
      // Move the section's double barline with it (first bar exempt either end).
      if (fromIndex > 0) removeLeftDoubleBarline(from);
      if (toIndex > 0) insertLeftDoubleBarline(to);
    },
  );
}
