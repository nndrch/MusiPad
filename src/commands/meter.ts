/**
 * SetMeter command (PRD §8, §9 M8). Edits the chart's time signature and keeps
 * the chart coherent with it. Meter is not just a label: it feeds the beat math
 * — the metronome click grid and measure lengths in `schedule.ts` re-derive from
 * `<time>` automatically (that reader is the single source of truth, Invariant
 * #1) — and it governs the **slash grid** (`////`, one slash per beat, the
 * rhythm-section's time-feel). So changing `4/4 → 3/4` must also rewrite each
 * bar's slash placeholders so the bar holds the right number of slashes.
 *
 * Scope (M8): the chart's **single governing meter** (the first `<time>`, like
 * Key relabels the first key — PRD §8). Charts here carry one meter throughout;
 * mid-piece `<time>` changes are out of scope.
 *
 * **Only slash bars are reflowed.** A bar whose rhythmic content is genuinely
 * slash placeholders (every main note a `<notehead>slash`) is regenerated to the
 * new grid; a bar with real melodic rhythm is left untouched (only the `<time>`
 * label changes). Reflowing real rhythm to a new meter is a different, much
 * larger problem (the lead-sheet rhythm engine, deferred — post-MVP P10); we own
 * the slash grid, not a melody's bar contents.
 *
 * Undo: the inverse snapshots the whole `<part>` subtree (`editElement`), so a
 * meter change — which touches every slash bar plus the time signature — reverts
 * byte-identically to the load baseline (Invariant #2).
 */

import { type Command, editElement } from './Command';

/** `<type>` name for a time-signature denominator (the slash's note value). */
const NOTE_TYPE_FOR_DENOMINATOR: Record<number, string> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th',
};

export function setMeter(beats: number, beatType: number): Command {
  return editElement(`Set meter to ${beats}/${beatType}`, firstPart, (part) =>
    setPartMeter(part, beats, beatType),
  );
}

/** First part of the score — holds the time signature, measures, and slashes. */
function firstPart(doc: Document): Element | null {
  return doc.querySelector('part');
}

function setPartMeter(part: Element, beats: number, beatType: number): void {
  // 1. Relabel the governing time signature (preserving siblings — @symbol,
  //    senza-misura, interchangeable — by only touching beats/beat-type).
  const time = part.querySelector('time');
  if (time) writeTime(time, beats, beatType);

  // 2. Reflow each slash bar to the new grid. `divisions` (ticks/quarter) is
  //    per-measure and carries forward until re-declared (guidelines §Golden).
  let divisions = 1;
  for (const measure of part.querySelectorAll(':scope > measure')) {
    const d = numberFrom(measure.querySelector(':scope > attributes > divisions'));
    if (d && d > 0) divisions = d;
    // A pickup/anacrusis bar is intentionally short — never pad it to a full bar.
    if (measure.getAttribute('implicit') === 'yes') continue;
    rewriteSlashBar(measure, beats, beatType, divisions);
  }
}

/** Set `<beats>`/`<beat-type>` text, creating them in schema order if missing. */
function writeTime(time: Element, beats: number, beatType: number): void {
  const doc = time.ownerDocument;
  let beatsEl = time.querySelector(':scope > beats');
  if (!beatsEl) {
    beatsEl = doc.createElement('beats');
    time.prepend(beatsEl);
  }
  beatsEl.textContent = String(beats);

  let typeEl = time.querySelector(':scope > beat-type');
  if (!typeEl) {
    typeEl = doc.createElement('beat-type');
    beatsEl.after(typeEl);
  }
  typeEl.textContent = String(beatType);
}

/**
 * Regenerate a bar's slash grid to `beats` slashes of value `beatType`. No-op
 * for a bar with no rhythmic content or with any non-slash (melodic) note.
 * Existing `<harmony>` chord symbols are preserved and re-anchored to the
 * nearest surviving beat (clamped into range, so a chord is never dropped).
 */
function rewriteSlashBar(
  measure: Element,
  beats: number,
  beatType: number,
  divisions: number,
): void {
  const doc = measure.ownerDocument;

  // Walk the bar: collect the rhythmic nodes (to replace) and note where each
  // harmony attaches (the beat index of the main note that follows it).
  const mainNotes: Element[] = [];
  const harmonies: { el: Element; beatPos: number }[] = [];
  const rhythmNodes: Element[] = [];
  let firstRhythm: Element | null = null;
  let beatPos = 0;

  for (const el of Array.from(measure.children)) {
    switch (el.tagName) {
      case 'harmony':
        harmonies.push({ el, beatPos });
        rhythmNodes.push(el);
        firstRhythm ??= el;
        break;
      case 'note': {
        // A <chord/> note stacks on the previous onset — it adds no beat.
        if (!el.querySelector(':scope > chord')) {
          mainNotes.push(el);
          beatPos++;
        }
        rhythmNodes.push(el);
        firstRhythm ??= el;
        break;
      }
      case 'backup':
      case 'forward':
        rhythmNodes.push(el);
        firstRhythm ??= el;
        break;
    }
  }

  if (mainNotes.length === 0) return; // nothing rhythmic to reflow
  // Reflow only a genuine slash bar; leave real rhythm to the (deferred) engine.
  const allSlash = mainNotes.every(
    (n) =>
      n.querySelector(':scope > notehead')?.textContent?.trim() === 'slash',
  );
  if (!allSlash) return;

  // Keep the chart's placeholder pitch (e.g. B4) by cloning an existing slash's.
  const pitchTemplate = mainNotes[0].querySelector(':scope > pitch');
  const durTicks = Math.round((divisions * 4) / beatType);
  const typeName = NOTE_TYPE_FOR_DENOMINATOR[beatType] ?? 'quarter';

  const anchor = firstRhythm!.previousElementSibling;
  for (const node of rhythmNodes) node.remove();

  // Rebuild: for each new beat, emit any harmonies anchored to it, then a slash.
  const lastBeat = beats - 1;
  const frag = doc.createDocumentFragment();
  for (let i = 0; i < beats; i++) {
    for (const h of harmonies) {
      if (Math.min(h.beatPos, lastBeat) === i) frag.appendChild(h.el);
    }
    frag.appendChild(makeSlashNote(doc, durTicks, typeName, pitchTemplate));
  }

  if (anchor) anchor.after(frag);
  else measure.prepend(frag);
}

/** A single slash placeholder note (`<pitch> <duration> <type> <notehead>`). */
function makeSlashNote(
  doc: Document,
  durTicks: number,
  typeName: string,
  pitchTemplate: Element | null,
): Element {
  const note = doc.createElement('note');
  const pitch = pitchTemplate
    ? (pitchTemplate.cloneNode(true) as Element)
    : defaultPitch(doc);
  const duration = doc.createElement('duration');
  duration.textContent = String(durTicks);
  const type = doc.createElement('type');
  type.textContent = typeName;
  const notehead = doc.createElement('notehead');
  notehead.textContent = 'slash';
  note.append(pitch, duration, type, notehead);
  return note;
}

/** Fallback placeholder pitch (B4) for charts with no existing slash to copy. */
function defaultPitch(doc: Document): Element {
  const pitch = doc.createElement('pitch');
  const step = doc.createElement('step');
  step.textContent = 'B';
  const octave = doc.createElement('octave');
  octave.textContent = '4';
  pitch.append(step, octave);
  return pitch;
}

function numberFrom(el: Element | null): number | null {
  const text = el?.textContent ?? null;
  if (text == null) return null;
  const n = Number.parseFloat(text);
  return Number.isNaN(n) ? null : n;
}
