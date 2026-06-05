/**
 * Build a playback schedule from the MusicXML DOM (PRD §9 M2). The DOM is the
 * single source of truth (Invariant #1); this reads it without mutating it.
 *
 * A chord chart carries **two distinct rhythms** (Berklee, see
 * `docs/chord-chart-generation-reference.md` §126/§321 and `musicxml-guidelines.md`):
 *   • the **harmonic rhythm** — chords change only where a `<harmony>` is
 *     written; each chord is *held until the next change*. This is what we
 *     **sound** (one block voicing per region — `chords` below).
 *   • the **slash rhythm** — `////`, one slash per beat, the rhythm-section's
 *     time-feel. The slashes are NOT chord articulations; they just keep time.
 *     We use them only to step the visual playhead (`onsets` below).
 * Sounding the chord on every slash would re-articulate it per beat (a
 * metronomic hammer) — the wrong reading. We never play the written placeholder
 * pitch either (PRD §3, §8).
 *
 * Positions are stored in **quarter-note beats** (tempo-independent), with a
 * separate tempo map (`tempoSegments`) converting beats→seconds. This keeps the
 * schedule stable across tempo edits (M4) and handles files with no tempo
 * (default 120 BPM, PRD §11) or tempo changes mid-piece.
 *
 * Open question resolved (PRD §15, roadmap M2): the span *before the first
 * harmony* is **silent**; once a chord begins it **sustains** until the next
 * `<harmony>` — so there is no mid-piece gap.
 *
 * `divisions` is per-measure and large (480, 10080 …); never assume 1
 * (guidelines §Golden-rules). Tracked elements (`divisions`, time signature,
 * tempo) carry forward across measures until re-declared.
 */

import { voicingFromHarmony } from './voicing';

/** A beat in the slash grid — used to step the visual playhead, not to sound. */
export interface Onset {
  /** Start position in quarter-note beats from the top of the score. */
  startQuarter: number;
}

/** A sounded chord region: a block voicing held from `startQuarter` for its span. */
export interface ChordEvent {
  /** Start position in quarter-note beats (where the `<harmony>` begins). */
  startQuarter: number;
  /** Span in quarter-note beats, until the next chord change (or the end). */
  durationQuarter: number;
  /** MIDI pitches of the voicing; empty ⇒ explicit silence (`kind="none"`). */
  pitches: number[];
}

/** A metronome click position (in quarter-beats), accenting downbeats. */
export interface MetroBeat {
  startQuarter: number;
  isDownbeat: boolean;
}

/** A tempo region: `bpm` (quarter-notes/min) applies from `startQuarter` on. */
export interface TempoSegment {
  startQuarter: number;
  bpm: number;
}

export interface PlaybackSchedule {
  /** One per slash/note — drives the playhead cursor (the time-feel grid). */
  onsets: Onset[];
  /** One per harmony region — what actually sounds (the harmonic rhythm). */
  chords: ChordEvent[];
  metronome: MetroBeat[];
  /** Sorted, non-empty, first segment at quarter 0 (default BPM if file had none). */
  tempoSegments: TempoSegment[];
  /** Total length of the chart in quarter-beats. */
  totalQuarters: number;
  /** Total length in seconds (via the tempo map). */
  totalSeconds: number;
}

/** Fallback tempo when a file carries none (PRD §8, §11). */
export const DEFAULT_BPM = 120;

/**
 * Convert a quarter-beat position to seconds under a piecewise-constant tempo
 * map. `segments` must be sorted by `startQuarter`, non-empty, and begin at 0.
 */
export function quarterToSeconds(
  q: number,
  segments: TempoSegment[],
): number {
  let seconds = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segEnd = segments[i + 1]?.startQuarter ?? Infinity;
    const secsPerQuarter = 60 / seg.bpm;
    if (q <= segEnd) {
      return seconds + Math.max(0, q - seg.startQuarter) * secsPerQuarter;
    }
    seconds += (segEnd - seg.startQuarter) * secsPerQuarter;
  }
  return seconds;
}

/**
 * Walk the first part of the score into a `PlaybackSchedule`. PoC assumes the
 * user works the first/primary part (PRD §15); multi-part is out of scope.
 */
export function buildSchedule(doc: Document): PlaybackSchedule {
  const part = doc.querySelector('part');
  const onsets: Onset[] = [];
  const chords: ChordEvent[] = [];
  const metronome: MetroBeat[] = [];
  const tempoSegments: TempoSegment[] = [];

  if (!part) {
    return emptySchedule();
  }

  // State that carries across measures until re-declared.
  let divisions = 1; // ticks per quarter note
  let beats = 4; // time-signature numerator
  let beatType = 4; // time-signature denominator
  let cursorQuarter = 0; // absolute position at the top of the current measure walk

  // Each written harmony, with the beat it begins on. Folded into sustained
  // chord regions after the walk (so we know where each one ends).
  const harmonyEvents: { atQuarter: number; pitches: number[] }[] = [];

  const measures = part.querySelectorAll(':scope > measure');
  for (const measure of measures) {
    const measureStartQuarter = cursorQuarter;
    let posInMeasureQuarter = 0; // position within this measure, in quarters

    for (const el of Array.from(measure.children)) {
      switch (el.tagName) {
        case 'attributes': {
          const div = numberFrom(el.querySelector(':scope > divisions'));
          if (div && div > 0) divisions = div;
          const b = numberFrom(el.querySelector(':scope > time > beats'));
          const bt = numberFrom(el.querySelector(':scope > time > beat-type'));
          if (b && b > 0) beats = b;
          if (bt && bt > 0) beatType = bt;
          break;
        }
        case 'direction':
        case 'sound': {
          // Tempo lives on a <sound tempo=…>, either standalone or in a direction.
          const sound =
            el.tagName === 'sound' ? el : el.querySelector('sound[tempo]');
          const bpm = numberFrom(sound?.getAttribute('tempo') ?? null);
          if (bpm && bpm > 0) {
            addTempo(tempoSegments, measureStartQuarter + posInMeasureQuarter, bpm);
          }
          break;
        }
        case 'harmony': {
          // A written harmony begins a chord region at the current beat (it
          // precedes its note in document order). null (unplayable root, e.g.
          // numeral/function) leaves the previous chord ringing; "none" yields
          // an empty voicing = explicit silence from here.
          const voicing = voicingFromHarmony(el);
          if (voicing) {
            harmonyEvents.push({
              atQuarter: measureStartQuarter + posInMeasureQuarter,
              pitches: voicing.pitches,
            });
          }
          break;
        }
        case 'note': {
          // A <chord/> note stacks on the previous one (same onset, no advance);
          // it adds no new beat to the slash grid — skip it.
          if (el.querySelector(':scope > chord')) break;
          const durTicks = numberFrom(el.querySelector(':scope > duration')) ?? 0;
          const durQuarter = divisions > 0 ? durTicks / divisions : 0;
          // Every note (slash or rest) is a beat the playhead steps through.
          onsets.push({ startQuarter: measureStartQuarter + posInMeasureQuarter });
          posInMeasureQuarter += durQuarter;
          break;
        }
        case 'backup': {
          const durTicks = numberFrom(el.querySelector(':scope > duration')) ?? 0;
          posInMeasureQuarter -= divisions > 0 ? durTicks / divisions : 0;
          // A malformed/over-long backup must not drive the position negative,
          // which would corrupt every following measure's start.
          posInMeasureQuarter = Math.max(0, posInMeasureQuarter);
          break;
        }
        case 'forward': {
          const durTicks = numberFrom(el.querySelector(':scope > duration')) ?? 0;
          posInMeasureQuarter += divisions > 0 ? durTicks / divisions : 0;
          break;
        }
      }
    }

    // Metronome clicks for this measure: one per time-signature beat
    // (`beats` of them, spaced 4/beatType quarters apart), downbeat accented.
    const beatSpacingQuarter = 4 / beatType;
    for (let i = 0; i < beats; i++) {
      metronome.push({
        startQuarter: measureStartQuarter + i * beatSpacingQuarter,
        isDownbeat: i === 0,
      });
    }

    // The measure's actual length is what its content summed to; fall back to
    // the nominal bar length when the measure is empty.
    const nominalBarQuarter = beats * (4 / beatType);
    cursorQuarter = measureStartQuarter + (posInMeasureQuarter || nominalBarQuarter);
  }

  const totalQuarters = cursorQuarter;

  // Fold harmony events into sustained regions: each chord runs until the next
  // one begins (or the end of the score). A zero-span region — two harmonies on
  // the same beat — is dropped, so the later one wins.
  for (let i = 0; i < harmonyEvents.length; i++) {
    const ev = harmonyEvents[i];
    const nextStart = harmonyEvents[i + 1]?.atQuarter ?? totalQuarters;
    const durationQuarter = nextStart - ev.atQuarter;
    if (durationQuarter > 0) {
      chords.push({ startQuarter: ev.atQuarter, durationQuarter, pitches: ev.pitches });
    }
  }

  // Guarantee a tempo segment at quarter 0 (default if the file had none).
  if (tempoSegments.length === 0 || tempoSegments[0].startQuarter > 0) {
    tempoSegments.unshift({ startQuarter: 0, bpm: DEFAULT_BPM });
  }

  return {
    onsets,
    chords,
    metronome,
    tempoSegments,
    totalQuarters,
    totalSeconds: quarterToSeconds(totalQuarters, tempoSegments),
  };
}

/** Insert/replace a tempo change, keeping `segments` sorted by position. */
function addTempo(segments: TempoSegment[], startQuarter: number, bpm: number) {
  const existing = segments.find((s) => s.startQuarter === startQuarter);
  if (existing) {
    existing.bpm = bpm;
    return;
  }
  segments.push({ startQuarter, bpm });
  segments.sort((a, b) => a.startQuarter - b.startQuarter);
}

function numberFrom(source: Element | string | null): number | null {
  const text = typeof source === 'string' ? source : (source?.textContent ?? null);
  if (text == null) return null;
  const n = Number.parseFloat(text);
  return Number.isNaN(n) ? null : n;
}

function emptySchedule(): PlaybackSchedule {
  return {
    onsets: [],
    chords: [],
    metronome: [],
    tempoSegments: [{ startQuarter: 0, bpm: DEFAULT_BPM }],
    totalQuarters: 0,
    totalSeconds: 0,
  };
}
