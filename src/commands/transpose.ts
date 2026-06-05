/**
 * Transpose command (PRD §8, §9 M4). A real pitch move (unlike Key relabel):
 * it rewrites every written pitch, the key signature(s), **and** the chord
 * symbols by the requested number of semitones. On a chord chart the audible
 * and visible content is the harmony, so transposing the chords is the point —
 * moving only the (slash-hidden, un-played) note pitches would do nothing
 * visible or audible. The `<transpose>` element (instrument written-vs-sounding)
 * is deliberately left untouched (PRD §8, guidelines).
 *
 * Invertibility (M4 AC: `+n` then `−n` ⇒ byte-identical to the load baseline):
 * pitches are transposed on a 2-axis coordinate — a *diatonic* step number and
 * a *chromatic* semitone — so a shift `(Δd, Δc)` is reversed exactly by
 * `(−Δd, −Δc)`. (Undo is separately exact: the inverse snapshots the `<part>`
 * subtree — `editElement`.)
 *
 * Spelling is **key-aware** (see `intervalForSemitones`): for the requested
 * chromatic interval we pick the letter-step count `Δd` whose resulting key
 * signature has the *fewest accidentals* (nearest 0 on the line of fifths). This
 * keeps `fifths` inside the conventional ±7 OSMD can render — so it never throws
 * "key signature spec: undefined" — and yields conventional spellings: C major
 * up two semitones → D major (not E𝄫), A major down one → A♭ major (not G♯).
 * Because the choice is a deterministic function of the current key, `+n`/`−n`
 * still cancel for every realistic key. (The only exception is the two extreme
 * keys F♯/G♭ and C♯/C♭ major at exactly ±6/±7 fifths, where a round trip can
 * land on the equivalent enharmonic spelling — musically identical; such keys
 * are practically absent from lead-sheet charts.)
 *
 * Scope (M4): the first part (this tool works the primary part — PRD §15); the
 * key choice uses that part's first key signature.
 */

import { type Command, editElement } from './Command';

/** Diatonic index (0–6) of each letter; C=0 … B=6. */
const STEP_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const INDEX_STEP = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Semitone of each natural step within its octave (C=0 … B=11). */
const STEP_SEMITONE = [0, 2, 4, 5, 7, 9, 11];

interface Interval {
  /** Δ diatonic-step (letter) count. */
  dDiatonic: number;
  /** Δ chromatic semitones. */
  dChromatic: number;
}

/**
 * Resolve a signed semitone count (−12…+12) to a (diatonic, chromatic) shift,
 * choosing the letter-step count `Δd` that minimises the transposed key's
 * accidentals. A chromatic interval shifts `fifths` by `7·Δc − 12·Δd`, so the
 * new signature is `keyFifths + 7·Δc − 12·Δd`; rounding `(keyFifths + 7·Δc)/12`
 * picks the `Δd` that lands that value nearest 0 — i.e. in [−6, 6], always
 * renderable. This is what makes transpose both crash-safe and well-spelled.
 */
function intervalForSemitones(semitones: number, keyFifths: number): Interval {
  const dChromatic = semitones;
  const dDiatonic = Math.round((keyFifths + 7 * dChromatic) / 12);
  return { dDiatonic, dChromatic };
}

export function transpose(semitones: number): Command {
  const dir = semitones >= 0 ? `+${semitones}` : String(semitones);
  return editElement(`Transpose ${dir} semitone(s)`, firstPart, (part) =>
    transposePart(part, semitones),
  );
}

/** First part of the score — holds the measures, notes, keys, and harmonies. */
function firstPart(doc: Document): Element | null {
  return doc.querySelector('part');
}

/** `fifths` of the part's first key signature (0 if none) — the spelling anchor. */
function firstKeyFifths(part: Element): number {
  const text = part.querySelector('attributes > key > fifths')?.textContent;
  const n = text != null ? Number.parseInt(text, 10) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

function transposePart(part: Element, semitones: number): void {
  const iv = intervalForSemitones(semitones, firstKeyFifths(part));
  // Written pitches (skip rests / unpitched — they have no <pitch>).
  for (const pitch of part.querySelectorAll('note > pitch')) {
    transposePitch(pitch, iv);
  }
  // Chord symbols: root, and the optional slash-chord bass.
  for (const root of part.querySelectorAll('harmony > root')) {
    transposePitchClass(root, 'root-step', 'root-alter', iv);
  }
  for (const bass of part.querySelectorAll('harmony > bass')) {
    transposePitchClass(bass, 'bass-step', 'bass-alter', iv);
  }
  // Key signature(s): a chromatic interval shifts `fifths` by 7·Δc − 12·Δd.
  const fifthsShift = 7 * iv.dChromatic - 12 * iv.dDiatonic;
  for (const fifths of part.querySelectorAll('attributes > key > fifths')) {
    const n = Number.parseInt(fifths.textContent ?? '', 10);
    if (!Number.isNaN(n)) fifths.textContent = String(n + fifthsShift);
  }
}

/** Transpose a full `<pitch>` (step + alter + octave) in place. */
function transposePitch(pitch: Element, iv: Interval): void {
  const stepEl = pitch.querySelector('step');
  const octaveEl = pitch.querySelector('octave');
  if (!stepEl || !octaveEl) return;
  const step = stepEl.textContent?.trim() ?? '';
  const di = STEP_INDEX[step];
  if (di === undefined) return;

  const octave = Number.parseInt(octaveEl.textContent ?? '', 10);
  if (Number.isNaN(octave)) return;
  const alter = readAlter(pitch);

  // Coordinates: diatonic = octave·7 + letterIndex; chromatic = octave·12 + semitone + alter.
  const diatonic = octave * 7 + di + iv.dDiatonic;
  const chromatic = octave * 12 + STEP_SEMITONE[di] + alter + iv.dChromatic;

  const newOctave = Math.floor(diatonic / 7);
  const newIndex = diatonic - newOctave * 7;
  const newAlter = chromatic - (newOctave * 12 + STEP_SEMITONE[newIndex]);

  stepEl.textContent = INDEX_STEP[newIndex];
  octaveEl.textContent = String(newOctave);
  writeAlter(pitch, 'alter', stepEl, newAlter);
}

/**
 * Transpose a pitch *class* (no octave) — a chord `root`/`bass`. Same coordinate
 * math, with the octave folded out and re-applied as a carry into the alter.
 */
function transposePitchClass(
  el: Element,
  stepTag: string,
  alterTag: string,
  iv: Interval,
): void {
  const stepEl = el.querySelector(stepTag);
  if (!stepEl) return;
  const step = stepEl.textContent?.trim() ?? '';
  const di = STEP_INDEX[step];
  if (di === undefined) return;
  const alter = readAlter(el, alterTag);

  const diatonic = di + iv.dDiatonic;
  const chromatic = STEP_SEMITONE[di] + alter + iv.dChromatic;
  const octaveCarry = Math.floor(diatonic / 7);
  const newIndex = diatonic - octaveCarry * 7;
  const newAlter = chromatic - (octaveCarry * 12 + STEP_SEMITONE[newIndex]);

  stepEl.textContent = INDEX_STEP[newIndex];
  writeAlter(el, alterTag, stepEl, newAlter);
}

function readAlter(el: Element, tag = 'alter'): number {
  const text = el.querySelector(tag)?.textContent;
  if (!text) return 0;
  const n = Number.parseFloat(text);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Write (or clear) an alter child, keeping schema child order: `<alter>` sits
 * right after `<step>` (likewise `root-alter` after `root-step`). A zero alter
 * is *removed* — a natural has no `<alter>` — so an unedited natural that gets
 * transposed and back serializes identically to the baseline (M4 AC).
 */
function writeAlter(el: Element, tag: string, stepEl: Element, value: number): void {
  let alterEl = el.querySelector(tag);
  if (value === 0) {
    alterEl?.remove();
    return;
  }
  if (!alterEl) {
    alterEl = el.ownerDocument.createElement(tag);
    stepEl.after(alterEl);
  }
  // Integers serialize as "1"/"-2"; microtone alters (e.g. 0.5) keep their value.
  alterEl.textContent = String(value);
}
