/**
 * SetTempo command (PRD §8, §9 M3/M4). Sets the chart's initial tempo in
 * measure 1, keeping the playback `sound[@tempo]` and the printed `metronome`
 * mark in sync. When the file has no tempo at all (common from the pipeline,
 * PRD §11) it *creates* both. This is the M3 demonstrator command and the
 * tempo half of M4's global edits.
 *
 * Scope (M3/M4): edits the initial tempo only. Mid-piece tempo changes are out
 * of scope for now (playback already reads every `sound[@tempo]` — schedule.ts).
 */

import { type Command, editElement } from './Command';

/** First measure of the first part — where the initial tempo lives. */
function firstMeasure(doc: Document): Element | null {
  return doc.querySelector('part > measure');
}

export function setTempo(bpm: number): Command {
  return editElement(`Set tempo to ${bpm} BPM`, firstMeasure, (measure) =>
    writeTempoIntoMeasure(measure, bpm),
  );
}

function writeTempoIntoMeasure(measure: Element, bpm: number): void {
  const value = String(bpm);
  const sound = measure.querySelector('sound[tempo]');
  const perMinute = measure.querySelector('metronome > per-minute');

  // Patch whichever representation(s) already exist. Real files carry both
  // (generation reference §4.9), so they stay in sync. The rare partial case
  // (only one present) is patched as-is; *creating* the missing partner to
  // fully re-sync sound ↔ metronome lands in M4 with the Tempo control (PRD §8).
  if (sound || perMinute) {
    if (sound) sound.setAttribute('tempo', value);
    if (perMinute) perMinute.textContent = value;
    return;
  }

  // Neither present: create a tempo direction (visible metronome + sounding
  // tempo), inserted right after <attributes> by convention (else at the top).
  const doc = measure.ownerDocument;
  const direction = doc.createElement('direction');
  direction.setAttribute('placement', 'above');

  const directionType = doc.createElement('direction-type');
  const metronome = doc.createElement('metronome');
  const beatUnit = doc.createElement('beat-unit');
  beatUnit.textContent = 'quarter';
  const pm = doc.createElement('per-minute');
  pm.textContent = value;
  metronome.append(beatUnit, pm);
  directionType.append(metronome);

  const snd = doc.createElement('sound');
  snd.setAttribute('tempo', value);

  direction.append(directionType, snd);

  const attributes = measure.querySelector(':scope > attributes');
  if (attributes) {
    attributes.after(direction);
  } else {
    measure.prepend(direction);
  }
}
