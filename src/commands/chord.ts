/**
 * Chord commands (PRD §8, §9 M6): add, edit, and remove a `<harmony>` at a
 * specific beat — all undoable via the command layer (Invariant #3).
 *
 * Unit of edit = the **measure**. Both commands locate the measure by its index
 * in the primary part and mutate inside it; `editElement` snapshots that whole
 * `<measure>` subtree for the inverse, so insert / rewrite / remove all undo and
 * redo exactly (no special-casing of structural changes — same robust pattern
 * Key/Transpose/Tempo use).
 *
 * A `<harmony>` attaches to the note that follows it in document order (it
 * precedes that note — guidelines §Harmony, matching `schedule.ts`). We address
 * a beat by the **ordinal of its sounding note** within the measure: the i-th
 * `<note>` that isn't a `<chord/>` member. That ordinal is exactly the i-th
 * graphical staff entry OSMD lays out, so the overlay anchor and the DOM target
 * line up (see `overlay/projector.ts`).
 *
 * Written children follow the schema child order
 * `root → kind → inversion → bass → degree → frame → offset → … → staff`
 * (guidelines §Harmony); on edit we replace only `root`/`kind`/`bass` and
 * **preserve** every other child (`inversion`, `degree`, `frame`, `offset`,
 * `@type`, `staff`) — Invariant #2.
 */

import { type Command, editElement } from './Command';
import { qualityLabel, type ChordSpec } from '../model/chordSymbol';

/**
 * Add a new chord, or replace the one already on this beat, with `spec`.
 * `measureIndex`/`noteIndex` are 0-based, in document order.
 */
export function setChordAt(
  measureIndex: number,
  noteIndex: number,
  spec: ChordSpec,
): Command {
  return editElement(
    `Set chord at ${measureIndex + 1}.${noteIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const note = nthSoundingNote(measure, noteIndex);
      if (!note) return;
      const harmony = attachedHarmony(note) ?? createHarmonyBefore(note);
      writeHarmony(harmony, spec);
    },
  );
}

/** Remove the chord attached to this beat (no-op if there isn't one). */
export function removeChordAt(
  measureIndex: number,
  noteIndex: number,
): Command {
  return editElement(
    `Remove chord at ${measureIndex + 1}.${noteIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      const note = nthSoundingNote(measure, noteIndex);
      if (note) attachedHarmony(note)?.remove();
    },
  );
}

/**
 * Move the chord on one beat to another beat (M11) — within a bar or across
 * bars. The whole `<harmony>` element is **relocated** (so its `kind/@text`,
 * `inversion`, `degree`, `frame`, `@type` ride along — Invariant #2), snapped
 * onto the target beat: a stale beat `<offset>` is dropped (it now sits exactly
 * on that beat) and any chord already on the target is **overwritten**. The
 * `<part>` is snapshotted for the inverse, since the move can touch two
 * measures (cf. `MoveSection`). No-op when source and target resolve to the
 * same beat (the caller also guards this, so no phantom undo step is created).
 */
export function moveChord(
  fromMeasure: number,
  fromNoteIndex: number,
  toMeasure: number,
  toNoteIndex: number,
): Command {
  return editElement(
    `Move chord ${fromMeasure + 1}.${fromNoteIndex + 1} → ${toMeasure + 1}.${toNoteIndex + 1}`,
    (doc) => doc.querySelector('part'),
    (part) => {
      const fromMeasureEl = nthMeasureIn(part, fromMeasure);
      const toMeasureEl = nthMeasureIn(part, toMeasure);
      if (!fromMeasureEl || !toMeasureEl) return;
      const fromNote = nthSoundingNote(fromMeasureEl, fromNoteIndex);
      const harmony = fromNote && attachedHarmony(fromNote);
      if (!harmony) return;
      const toNote = nthSoundingNote(toMeasureEl, toNoteIndex);
      if (!toNote || toNote === fromNote) return;
      // Overwrite an existing chord on the target, then relocate ours onto it.
      // `before` moves the node out of its old measure, leaving that beat empty.
      attachedHarmony(toNote)?.remove();
      harmony.querySelector(':scope > offset')?.remove();
      toNote.before(harmony);
    },
  );
}

// — measure / note location ————————————————————————————————————————————————

/** The `measureIndex`-th `<measure>` of the primary part, or null. */
function nthMeasure(doc: Document, measureIndex: number): Element | null {
  const part = doc.querySelector('part');
  return part ? nthMeasureIn(part, measureIndex) : null;
}

/** The `measureIndex`-th `<measure>` within a given `<part>` element. */
function nthMeasureIn(part: Element, measureIndex: number): Element | null {
  return part.querySelectorAll(':scope > measure')[measureIndex] ?? null;
}

/**
 * The `noteIndex`-th *sounding* note in a measure — a `<note>` that is not a
 * `<chord/>` member (chord members stack on the previous onset and share a
 * staff entry, so they don't count as a beat). Mirrors `schedule.ts`/OSMD.
 */
function nthSoundingNote(measure: Element, noteIndex: number): Element | null {
  let i = 0;
  for (const note of measure.querySelectorAll(':scope > note')) {
    if (note.querySelector(':scope > chord')) continue;
    if (i === noteIndex) return note;
    i++;
  }
  return null;
}

/**
 * The `<harmony>` that belongs to `note` (sits before it, after the previous
 * sounding note), or null. Walks back over non-note siblings (directions,
 * barlines) and stops at the previous note.
 */
function attachedHarmony(note: Element): Element | null {
  let el = note.previousElementSibling;
  while (el) {
    if (el.tagName === 'note') return null;
    if (el.tagName === 'harmony') return el;
    el = el.previousElementSibling;
  }
  return null;
}

function createHarmonyBefore(note: Element): Element {
  const harmony = note.ownerDocument.createElement('harmony');
  note.before(harmony);
  return harmony;
}

// — harmony serialization ——————————————————————————————————————————————————

/**
 * Write `spec` into `harmony`, replacing only the children we own and keeping
 * schema child order. Existing `inversion`/`degree`/`frame`/`offset`/`staff`
 * and the `@type` attribute are left untouched.
 */
function writeHarmony(harmony: Element, spec: ChordSpec): void {
  const doc = harmony.ownerDocument;
  harmony.querySelector(':scope > root')?.remove();
  harmony.querySelector(':scope > kind')?.remove();
  harmony.querySelector(':scope > bass')?.remove();

  const kind = makeKind(doc, spec);

  // No-chord (N.C.): a bare `kind=none`, no root/bass.
  if (spec.kind === 'none' && !spec.rootStep) {
    harmony.prepend(kind);
    return;
  }

  // [root, kind, …kept children…] — prepend kind first, then root before it.
  harmony.prepend(kind);
  harmony.prepend(makeRoot(doc, spec));

  if (spec.bassStep) {
    // bass goes after kind/inversion, before degree/frame/offset (schema order).
    const inversion = harmony.querySelector(':scope > inversion');
    (inversion ?? kind).after(makeBass(doc, spec));
  }
}

function makeRoot(doc: Document, spec: ChordSpec): Element {
  const root = doc.createElement('root');
  root.appendChild(textEl(doc, 'root-step', spec.rootStep));
  if (spec.rootAlter !== 0) {
    root.appendChild(textEl(doc, 'root-alter', String(spec.rootAlter)));
  }
  return root;
}

function makeBass(doc: Document, spec: ChordSpec): Element {
  const bass = doc.createElement('bass');
  bass.appendChild(textEl(doc, 'bass-step', spec.bassStep ?? ''));
  if (spec.bassAlter) {
    bass.appendChild(textEl(doc, 'bass-alter', String(spec.bassAlter)));
  }
  return bass;
}

function makeKind(doc: Document, spec: ChordSpec): Element {
  const kind = doc.createElement('kind');
  // `@text` = the displayed quality label (Berklee house style); omitted for a
  // plain major triad, which reads as a bare root. This is what makes an
  // exported chart read professionally in any renderer (guidelines §Harmony).
  const label = qualityLabel(spec.kind);
  if (label !== '') kind.setAttribute('text', label);
  kind.textContent = spec.kind;
  return kind;
}

function textEl(doc: Document, tag: string, text: string): Element {
  const el = doc.createElement(tag);
  el.textContent = text;
  return el;
}
