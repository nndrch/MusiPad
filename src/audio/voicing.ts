/**
 * Chord realization (PRD §9 M2, the headline feature): turn a MusicXML
 * `harmony` into a set of MIDI pitches — a block voicing we can sound.
 *
 * We never play the written placeholder pitches (slash noteheads on a chart are
 * a fixed line, e.g. B4); instead we sound the *active chord* at each onset
 * (PRD §3 non-goals, §8 chord mapping). This module is the chord→pitches half;
 * `schedule.ts` decides *when*, `synth.ts` makes the sound.
 *
 * Pure + dependency-free so it's trivially testable. Voicings are deliberately
 * simple block chords (root-position triad/7th, mid register, bass below for
 * slash chords); voice-leading/inversions are post-MVP (PRD §15).
 */

/** A parsed chord ready to be sounded. */
export interface Voicing {
  /** MIDI note numbers to sound together (empty ⇒ silence, e.g. kind "none"). */
  pitches: number[];
}

/**
 * Semitone intervals above the root for each MusicXML `kind-value`
 * (PRD §8, guidelines §5). Covers the common enum richly and degrades the
 * exotic/functional values to a musically-nearest stack rather than failing.
 */
const KIND_INTERVALS: Record<string, number[]> = {
  // Triads
  major: [0, 4, 7],
  minor: [0, 3, 7],
  augmented: [0, 4, 8],
  diminished: [0, 3, 6],
  // Sevenths
  dominant: [0, 4, 7, 10],
  'major-seventh': [0, 4, 7, 11],
  'minor-seventh': [0, 3, 7, 10],
  'half-diminished': [0, 3, 6, 10],
  'diminished-seventh': [0, 3, 6, 9],
  'augmented-seventh': [0, 4, 8, 10],
  'major-minor': [0, 3, 7, 11], // minor triad + major 7th (mi(maj7))
  // Sixths
  'major-sixth': [0, 4, 7, 9],
  'minor-sixth': [0, 3, 7, 9],
  // Extended — ninths
  'dominant-ninth': [0, 4, 7, 10, 14],
  'major-ninth': [0, 4, 7, 11, 14],
  'minor-ninth': [0, 3, 7, 10, 14],
  // Extended — elevenths (omit the 3rd, the conventional voicing to avoid the
  // m9 clash between 3rd and 11th)
  'dominant-11th': [0, 7, 10, 14, 17],
  'major-11th': [0, 7, 11, 14, 17],
  'minor-11th': [0, 3, 7, 10, 14, 17],
  // Extended — thirteenths (drop the 11th, the standard reduction)
  'dominant-13th': [0, 4, 7, 10, 14, 21],
  'major-13th': [0, 4, 7, 11, 14, 21],
  'minor-13th': [0, 3, 7, 10, 14, 21],
  // Suspended
  'suspended-second': [0, 2, 7],
  'suspended-fourth': [0, 5, 7],
  // Functional sixths / other — degrade to a sensible neighbour
  Neapolitan: [0, 4, 7], // a major triad (♭II)
  Italian: [0, 4, 10], // It+6: root, M3, ♭7-as-aug6
  French: [0, 4, 6, 10],
  German: [0, 4, 7, 10], // Ger+6 is enharmonically a dominant 7th — same sound
  Tristan: [0, 3, 6, 10], // half-diminished-ish
  pedal: [0], // single sustained root
  power: [0, 7], // root + fifth
  none: [], // explicit "no chord" ⇒ silence
  other: [0, 4, 7], // unknown ⇒ plain triad
};

/** Pitch class (0–11, C=0) for a diatonic step letter A–G. */
const STEP_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Register anchor: the root of every chord is placed in the octave starting at
 * MIDI 48 (C3) — i.e. root MIDI ∈ [48, 59] — so triads/7ths sit in a warm mid
 * range. Slash-chord bass notes go an octave below that.
 */
const ROOT_OCTAVE_BASE = 48; // C3
const BASS_OCTAVE_BASE = 36; // C2

/**
 * Resolve a `<harmony>` element to a block voicing (MIDI pitches), or `null`
 * when there's nothing playable (no root / explicit "none"). Reads `root`
 * (`root-step` + optional `root-alter`), `kind`, and optional `bass`
 * (`bass-step` + optional `bass-alter`) for slash chords. `numeral`/`function`
 * roots are out of PoC scope (guidelines §Harmony) → treated as unplayable.
 */
export function voicingFromHarmony(harmony: Element): Voicing | null {
  const rootStep = harmony
    .querySelector('root > root-step')
    ?.textContent?.trim()
    .toUpperCase();
  if (!rootStep || !(rootStep in STEP_SEMITONE)) return null;

  const rootAlter = numberOr(
    harmony.querySelector('root > root-alter')?.textContent,
    0,
  );

  const kind =
    harmony.querySelector('kind')?.textContent?.trim().toLowerCase() ?? 'major';
  // Enum keys are lower-case except the functional/Tristan names; match either.
  const intervals = KIND_INTERVALS[kind] ?? lookupMixedCase(kind) ?? [0, 4, 7];
  if (intervals.length === 0) return { pitches: [] };

  const rootPc = (STEP_SEMITONE[rootStep] + rootAlter + 120) % 12;
  const rootMidi = ROOT_OCTAVE_BASE + rootPc;
  const pitches = intervals.map((semi) => rootMidi + semi);

  // Slash chord: sound the alternate bass an octave below the chord body.
  const bassStep = harmony
    .querySelector('bass > bass-step')
    ?.textContent?.trim()
    .toUpperCase();
  if (bassStep && bassStep in STEP_SEMITONE) {
    const bassAlter = numberOr(
      harmony.querySelector('bass > bass-alter')?.textContent,
      0,
    );
    const bassPc = (STEP_SEMITONE[bassStep] + bassAlter + 120) % 12;
    pitches.unshift(BASS_OCTAVE_BASE + bassPc);
  }

  return { pitches };
}

/** `kind` values that aren't lower-case in the enum (functional sixths, etc.). */
function lookupMixedCase(kindLower: string): number[] | undefined {
  for (const key of Object.keys(KIND_INTERVALS)) {
    if (key.toLowerCase() === kindLower) return KIND_INTERVALS[key];
  }
  return undefined;
}

function numberOr(text: string | null | undefined, fallback: number): number {
  if (text == null) return fallback;
  const n = Number.parseFloat(text);
  return Number.isNaN(n) ? fallback : n;
}

/** MIDI note number → frequency in Hz (A4 = MIDI 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
