/**
 * Slash command (PRD §8, §9 M7): toggle rhythm slashes on a bar.
 *
 * Mechanism is locked by spike **S1** ([`docs/spikes.md`](../../docs/spikes.md)):
 * OSMD ignores the `measure-style/slash` region form, so we mark slashes
 * per-note with `<notehead>slash</notehead>` (which OSMD renders and the
 * pipeline emits). The edit is **measure-scoped** — `editElement` snapshots the
 * whole `<measure>` for the inverse (Invariant #3), so toggling on/off
 * round-trips exactly, including each note's original notehead (Invariant #2).
 * Only the `<notehead>` child changes — `<duration>` (per-measure divisions are
 * large, e.g. 480) / pitch / type are never touched.
 */

import { type Command, editElement } from './Command';

/** A bar's slash state, for the toolbar toggle's enabled/active reflection. */
export interface BarSlashState {
  /** The bar has at least one slashable note (a sounding, non-rest note). */
  slashable: boolean;
  /** Every slashable note already carries `<notehead>slash</notehead>`. */
  allSlashed: boolean;
}

/**
 * Set (`on`) or clear slash noteheads on every sounding note of bar
 * `measureIndex`. Undoable; rests and `<chord/>` members are left alone.
 */
export function setBarSlashes(measureIndex: number, on: boolean): Command {
  return editElement(
    `${on ? 'Add' : 'Remove'} slashes in bar ${measureIndex + 1}`,
    (doc) => nthMeasure(doc, measureIndex),
    (measure) => {
      for (const note of slashableNotes(measure)) {
        if (on) setSlashNotehead(note);
        else clearSlashNotehead(note);
      }
    },
  );
}

/** Read a bar's slash state — drives the selected-bar toolbar toggle. */
export function barSlashState(
  doc: Document,
  measureIndex: number,
): BarSlashState {
  const measure = nthMeasure(doc, measureIndex);
  if (!measure) return { slashable: false, allSlashed: false };
  const notes = slashableNotes(measure);
  return {
    slashable: notes.length > 0,
    allSlashed: notes.length > 0 && notes.every(isSlashed),
  };
}

// — internals ———————————————————————————————————————————————————————————————

/** The `measureIndex`-th `<measure>` of the primary part, or null. */
function nthMeasure(doc: Document, measureIndex: number): Element | null {
  const part = doc.querySelector('part');
  if (!part) return null;
  return part.querySelectorAll(':scope > measure')[measureIndex] ?? null;
}

/**
 * A bar's slashable notes: sounding notes (not `<chord/>` members) that aren't
 * rests. Chord members share an onset (no separate slash) and rests carry no
 * slash, so both are skipped.
 */
function slashableNotes(measure: Element): Element[] {
  return Array.from(measure.querySelectorAll(':scope > note')).filter(
    (n) =>
      !n.querySelector(':scope > chord') && !n.querySelector(':scope > rest'),
  );
}

function isSlashed(note: Element): boolean {
  return (
    note.querySelector(':scope > notehead')?.textContent?.trim() === 'slash'
  );
}

function setSlashNotehead(note: Element): void {
  const existing = note.querySelector(':scope > notehead');
  if (existing) {
    existing.textContent = 'slash';
    return;
  }
  const nh = note.ownerDocument.createElement('notehead');
  nh.textContent = 'slash';
  // `<notehead>` follows type/dot/accidental/time-modification/stem and precedes
  // notehead-text/staff/beam/notations/lyric/play (MusicXML <note> child order).
  // Insert before the first such following child, else append (matches the
  // pipeline, which writes `<notehead>` right after `<type>`).
  const after = note.querySelector(
    ':scope > notehead-text, :scope > staff, :scope > beam, :scope > notations, :scope > lyric, :scope > play, :scope > footnote, :scope > level',
  );
  if (after) after.before(nh);
  else note.appendChild(nh);
}

/** Remove only a slash notehead (leave a non-slash notehead, e.g. `x`, intact). */
function clearSlashNotehead(note: Element): void {
  const nh = note.querySelector(':scope > notehead');
  if (nh && nh.textContent?.trim() === 'slash') nh.remove();
}
