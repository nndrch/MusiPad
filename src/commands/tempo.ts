/**
 * SetTempo command (PRD §8, §9 M3/M4). Sets the chart's initial tempo in
 * measure 1, keeping the playback `sound[@tempo]` and the printed `metronome`
 * mark in sync. When the file has no tempo at all (common from the pipeline,
 * PRD §11) it *creates* both; when only one of the two exists (a partial file)
 * it patches that one **and creates the missing partner** so the sounding tempo
 * and the printed mark never disagree (M4 — PRD §8).
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
  const doc = measure.ownerDocument;
  const sound = measure.querySelector('sound[tempo]');
  const metronome = measure.querySelector('metronome');
  const perMinute = metronome?.querySelector('per-minute');

  // Patch whichever representation(s) exist…
  if (sound) sound.setAttribute('tempo', value);
  if (perMinute) perMinute.textContent = value;

  // …then create any missing partner so the sounding tempo and the printed
  // mark always agree (PRD §8). Both branches reuse the other's `<direction>`
  // when there is one, keeping the new node next to its sibling.

  // Sounding tempo present but no printed metronome → add a metronome.
  if (sound && !metronome) {
    const directionType = makeMetronomeType(doc, value);
    const direction = sound.closest('direction');
    if (direction) {
      // Child order is `direction-type+, offset?, …, staff?, sound?` — every
      // direction-type must precede offset/staff/sound. Insert after the LAST
      // existing direction-type (not merely before <sound>, which would land
      // after any offset/staff sitting between them).
      const dts = direction.querySelectorAll(':scope > direction-type');
      const lastDt = dts[dts.length - 1];
      if (lastDt) lastDt.after(directionType);
      else direction.prepend(directionType);
    } else {
      sound.before(wrapDirection(doc, directionType));
    }
  }

  // Printed metronome present but no sounding tempo → add a <sound tempo>.
  if (metronome && !sound) {
    const snd = makeSound(doc, value);
    const direction = metronome.closest('direction');
    // Child order: <sound> follows the direction-type(s).
    if (direction) direction.append(snd);
    else metronome.closest('direction-type')?.after(snd);
  }

  if (sound || metronome) return;

  // Neither present: create a tempo direction (visible metronome + sounding
  // tempo), inserted right after <attributes> by convention (else at the top).
  const direction = wrapDirection(doc, makeMetronomeType(doc, value));
  direction.append(makeSound(doc, value));

  const attributes = measure.querySelector(':scope > attributes');
  if (attributes) attributes.after(direction);
  else measure.prepend(direction);
}

/** `<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>N</per-minute></metronome></direction-type>` */
function makeMetronomeType(doc: Document, value: string): Element {
  const directionType = doc.createElement('direction-type');
  const metronome = doc.createElement('metronome');
  const beatUnit = doc.createElement('beat-unit');
  beatUnit.textContent = 'quarter';
  const pm = doc.createElement('per-minute');
  pm.textContent = value;
  metronome.append(beatUnit, pm);
  directionType.append(metronome);
  return directionType;
}

/** `<sound tempo="N"/>` */
function makeSound(doc: Document, value: string): Element {
  const snd = doc.createElement('sound');
  snd.setAttribute('tempo', value);
  return snd;
}

/** Wrap content in a `<direction placement="above">`. */
function wrapDirection(doc: Document, ...children: Element[]): Element {
  const direction = doc.createElement('direction');
  direction.setAttribute('placement', 'above');
  direction.append(...children);
  return direction;
}
