/**
 * Load-time defaults (M4). Pipeline output can arrive with no key and/or no
 * tempo (PRD §11). A chord chart needs both to edit and play coherently, so on
 * load we assign sensible defaults — **C major** and **120 BPM** — directly into
 * the DOM, and report which were applied so the UI can show a dismissible alert.
 *
 * This is a load-time normalization (like the prolog capture in `xmlDoc.ts`),
 * not an undoable command: the defaulted document *is* the starting state, so
 * the round-trip baseline (Invariant #2, used from M7's download) is taken from
 * it. Tempo reuses the `setTempo` writer (creates synced `sound`+`metronome`).
 */

import { setTempo } from '../commands/tempo';

/** C major (no sharps/flats). */
const DEFAULT_FIFTHS = 0;
/** Quarter-notes per minute — the same fallback playback already uses (M2). */
const DEFAULT_BPM = 120;

export interface DefaultsApplied {
  key: boolean;
  tempo: boolean;
}

export function applyDefaults(doc: Document): DefaultsApplied {
  return { key: ensureKey(doc), tempo: ensureTempo(doc) };
}

/** Insert a default key signature when the score has none. */
function ensureKey(doc: Document): boolean {
  if (doc.querySelector('attributes key')) return false;
  const measure = doc.querySelector('part > measure');
  if (!measure) return false;

  let attributes = measure.querySelector(':scope > attributes');
  if (!attributes) {
    attributes = doc.createElement('attributes');
    measure.prepend(attributes);
  }

  const key = doc.createElement('key');
  const fifths = doc.createElement('fifths');
  fifths.textContent = String(DEFAULT_FIFTHS);
  key.append(fifths);

  // Child order in <attributes>: key follows <divisions> and precedes <time>/<clef>.
  const divisions = attributes.querySelector(':scope > divisions');
  if (divisions) divisions.after(key);
  else attributes.prepend(key);
  return true;
}

/** Create a default tempo (synced sound + metronome) when the score has none. */
function ensureTempo(doc: Document): boolean {
  // A file with either representation already carries a tempo (readTempo reads
  // both); only a complete absence counts as "no tempo".
  if (doc.querySelector('sound[tempo]') || doc.querySelector('metronome')) {
    return false;
  }
  setTempo(DEFAULT_BPM).apply(doc);
  return true;
}
