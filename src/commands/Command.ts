/**
 * The command layer — the editing spine (PRD §7.3, Invariant #3). Every DOM
 * mutation is a `Command` so undo/redo (and every future edit) come for free;
 * no component mutates the DOM directly.
 *
 * Inverse strategy (PRD §7.3): snapshot the affected subtree at command-creation
 * time; the inverse restores it. Simple and robust for the sparse edits this
 * tool makes — no diffing. `apply` patches in place (so the first application
 * leaves untouched siblings byte-identical, Invariant #2); the inverse restores
 * the captured subtree exactly, so undo returns the edited region to its prior
 * serialization.
 */

export interface Command {
  /** Human-readable label (debugging / future history UI). */
  readonly label: string;
  /** Mutate the DOM in place. */
  apply(doc: Document): void;
  /**
   * Produce the reversing command, capturing pre-state **now** (before `apply`
   * runs). `History` calls `invert(doc)` before `apply(doc)` on dispatch.
   */
  invert(doc: Document): Command;
}

/**
 * Build a command that edits a single element (located by `locate`) in place,
 * with a snapshot-based inverse. `invert` clones the located subtree as it
 * stands now and returns a command that restores that clone — so it round-trips
 * exactly through any undo/redo sequence.
 */
export function editElement(
  label: string,
  locate: (doc: Document) => Element | null,
  mutate: (el: Element) => void,
): Command {
  return {
    label,
    apply(doc) {
      const el = locate(doc);
      if (el) mutate(el);
    },
    invert(doc) {
      const el = locate(doc);
      const snapshot = el ? (el.cloneNode(true) as Element) : null;
      return restoreElement(label, locate, snapshot);
    },
  };
}

/**
 * A command that restores the located element to `snapshot` (a detached clone).
 * Self-symmetric: its own inverse snapshots the current element, so undo↔redo
 * cycles are exact. Used as the inverse produced by `editElement`.
 */
function restoreElement(
  label: string,
  locate: (doc: Document) => Element | null,
  snapshot: Element | null,
): Command {
  return {
    label: `Restore: ${label}`,
    apply(doc) {
      const el = locate(doc);
      if (el && snapshot) el.replaceWith(snapshot.cloneNode(true));
    },
    invert(doc) {
      const el = locate(doc);
      const before = el ? (el.cloneNode(true) as Element) : snapshot;
      return restoreElement(label, locate, before);
    },
  };
}
