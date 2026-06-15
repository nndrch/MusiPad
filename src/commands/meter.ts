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
 * label changes). The slash-grid generator itself lives in
 * [`model/slashGrid`](../model/slashGrid.ts) and is shared with the M9 render
 * clone (which forces every bar to the grid); here we call it with the default
 * `force: false`, so M8's slash-only reflow is unchanged.
 *
 * Undo: the inverse snapshots the whole `<part>` subtree (`editElement`), so a
 * meter change — which touches every slash bar plus the time signature — reverts
 * byte-identically to the load baseline (Invariant #2).
 */

import { type Command, editElement } from './Command';
import { numberFrom, rewriteSlashBar } from '../model/slashGrid';

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
