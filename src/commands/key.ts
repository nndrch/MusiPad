/**
 * SetKeySignature command (PRD §8, §9 M4). Relabels the chart's key signature —
 * a *display* change only: it patches `fifths` (and `mode`) on the first
 * `attributes/key` and **does not move pitches** (that's Transpose — see
 * `transpose.ts`). Per PRD §8 it patches only `fifths`/`mode` and preserves
 * every sibling the spec allows (`cancel`, `key-octave`, the per-staff `number`
 * and `print-object` attributes) — guaranteed because the inverse snapshots the
 * whole `<key>` subtree (`editElement`).
 *
 * Scope (M4): edits the first key signature (the chart's main key). Mid-piece
 * key changes are a separate, later concern.
 */

import { type Command, editElement } from './Command';

/** The chart's main key signature — the first `attributes/key` in the score. */
function firstKey(doc: Document): Element | null {
  return doc.querySelector('attributes key');
}

/**
 * Relabel the key signature to `fifths` (−7…+7) with the given `mode`
 * (`major`/`minor`/… or null to leave the mode unset). Child order in `<key>`
 * is `cancel? , fifths , mode?`, so a created `fifths` goes after any `cancel`
 * and a created `mode` goes right after `fifths`.
 */
export function setKeySignature(fifths: number, mode: string | null): Command {
  return editElement(`Set key to ${fifths} fifths`, firstKey, (key) =>
    writeKey(key, fifths, mode),
  );
}

function writeKey(key: Element, fifths: number, mode: string | null): void {
  const doc = key.ownerDocument;

  let fifthsEl = key.querySelector('fifths');
  if (!fifthsEl) {
    fifthsEl = doc.createElement('fifths');
    const cancel = key.querySelector('cancel');
    if (cancel) cancel.after(fifthsEl);
    else key.prepend(fifthsEl);
  }
  fifthsEl.textContent = String(fifths);

  let modeEl = key.querySelector('mode');
  if (mode) {
    if (!modeEl) {
      modeEl = doc.createElement('mode');
      fifthsEl.after(modeEl);
    }
    modeEl.textContent = mode;
  } else {
    modeEl?.remove();
  }
}
