/**
 * Slash-grid generator (PRD §6.5, §8, §9 M8/M9). One bar's rhythm rendered as a
 * uniform per-beat slash grid (`////`, the rhythm-section time-feel): N slashes
 * of value `beat-type`, where N is the meter's `beats` (numerator).
 *
 * Two callers share this generator:
 *   • **M8 `setMeter`** mutates the **real** DOM and reflows only genuine slash
 *     bars — `force: false` (the default) keeps that exact behavior (a bar with
 *     real melodic rhythm is left untouched; reflowing melody is the deferred
 *     lead-sheet engine, P10).
 *   • **M9 render clone** flattens **every** bar to the grid so the chart shows
 *     only slashes (no written melody) — `force: true` skips the slash-only
 *     guard. This runs on the throwaway OSMD clone (`buildRenderDoc`), never the
 *     real DOM, so playback/download/undo and Invariant #2 are untouched.
 *
 * Existing `<harmony>` chord symbols are always preserved and re-anchored to the
 * nearest surviving beat by their note-ordinal position (clamped into range, so
 * a chord is never dropped). `<barline>` and `<attributes>` are never touched.
 */

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

/** Options for the slash-grid rewrite. */
interface SlashGridOptions {
  /**
   * When true, flatten the bar even if it holds real (non-slash) notes — used
   * for the M9 render clone. When false (default), a bar with any non-slash
   * main note is left untouched (M8's slash-only reflow).
   */
  force?: boolean;
}

/**
 * Flatten every (non-pickup) bar of the chart to the governing meter's slash
 * grid. Reads the governing time signature (first `<time>`) and walks measures
 * with `divisions` carry-forward, skipping `implicit="yes"` pickup bars — the
 * same traversal `setMeter` uses. Intended for the M9 render clone with
 * `{ force: true }`.
 */
export function applySlashGrid(doc: Document, opts: SlashGridOptions = {}): void {
  const part = doc.querySelector('part');
  if (!part) return;

  const time = part.querySelector('time');
  const beats = numberFrom(time ? time.querySelector(':scope > beats') : null);
  const beatType = numberFrom(
    time ? time.querySelector(':scope > beat-type') : null,
  );
  if (!beats || beats <= 0 || !beatType || beatType <= 0) return;

  let divisions = 1;
  for (const measure of part.querySelectorAll(':scope > measure')) {
    const d = numberFrom(measure.querySelector(':scope > attributes > divisions'));
    if (d && d > 0) divisions = d;
    // A pickup/anacrusis bar is intentionally short — never pad it to a full bar.
    if (measure.getAttribute('implicit') === 'yes') continue;
    rewriteSlashBar(measure, beats, beatType, divisions, opts);
  }
}

/**
 * Regenerate a bar's slash grid to `beats` slashes of value `beatType`. No-op
 * for a bar with no rhythmic content, or (unless `force`) for a bar with any
 * non-slash (melodic) note. Existing `<harmony>` symbols are preserved and
 * re-anchored to the nearest surviving beat (clamped, so none is dropped).
 */
export function rewriteSlashBar(
  measure: Element,
  beats: number,
  beatType: number,
  divisions: number,
  opts: SlashGridOptions = {},
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
  // M8 (force:false): reflow only a genuine slash bar; leave real rhythm to the
  // (deferred) engine. M9 (force:true): flatten everything — the melody is hidden
  // in the chart view, so even a melodic bar renders as a uniform slash grid.
  if (!opts.force) {
    const allSlash = mainNotes.every(
      (n) =>
        n.querySelector(':scope > notehead')?.textContent?.trim() === 'slash',
    );
    if (!allSlash) return;
  }

  // Keep the chart's placeholder pitch (e.g. B4) by cloning an existing note's.
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

/** Fallback placeholder pitch (B4) for charts with no existing note to copy. */
function defaultPitch(doc: Document): Element {
  const pitch = doc.createElement('pitch');
  const step = doc.createElement('step');
  step.textContent = 'B';
  const octave = doc.createElement('octave');
  octave.textContent = '4';
  pitch.append(step, octave);
  return pitch;
}

/** Parse an element's text as a number, or null. Shared with `meter.ts`. */
export function numberFrom(el: Element | null): number | null {
  const text = el?.textContent ?? null;
  if (text == null) return null;
  const n = Number.parseFloat(text);
  return Number.isNaN(n) ? null : n;
}
