/**
 * Read-only summary of a score for the header (Key, Tempo/BPM). Derived from
 * the MusicXML DOM — the single source of truth (Invariant #1). M4 makes these
 * editable; for now they are display-only.
 *
 * Key reading is W3C-compliant for all `mode` values (PRD §8): besides
 * major/minor, MusicXML allows the church modes and `none`, and non-traditional
 * keys (`key-step`/`key-alter`) with no `fifths` — all handled gracefully.
 */
export interface ScoreInfo {
  /** e.g. "G major", "E minor", "D dorian", or null if no key is written. */
  key: string | null;
  /** Quarter-notes per minute, or null if none is written. */
  tempo: number | null;
  /** Style/feel marking, e.g. "Medium Swing" — Berklee lead-sheet convention. */
  style: string | null;
}

/**
 * Note name for a position on the line of fifths, indexed `fifths + 8`
 * (so 0 → "C"). Covers the range needed for every mode of fifths −7…+7.
 */
const LINE_OF_FIFTHS = [
  'F♭',
  'C♭',
  'G♭',
  'D♭',
  'A♭',
  'E♭',
  'B♭', // −8 … −2
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B', // −1 … +5
  'F♯',
  'C♯',
  'G♯',
  'D♯',
  'A♯',
  'E♯',
  'B♯', // +6 … +12
];

/**
 * A mode's tonic is a scale degree of the parent major key, i.e. an offset
 * along the line of fifths from the major tonic of the same signature.
 */
const MODE_FIFTHS_OFFSET: Record<string, number> = {
  lydian: -1,
  major: 0,
  ionian: 0,
  mixolydian: 1,
  dorian: 2,
  aeolian: 3,
  minor: 3,
  phrygian: 4,
  locrian: 5,
};

export function readScoreInfo(doc: Document): ScoreInfo {
  return { key: readKey(doc), tempo: readTempo(doc), style: readStyle(doc) };
}

/**
 * Style/feel marking — by lead-sheet convention the first free-text `words`
 * direction at the top of the chart (first measure), e.g. "Medium Swing".
 */
function readStyle(doc: Document): string | null {
  const firstMeasure = doc.querySelector('part measure');
  const words = firstMeasure
    ?.querySelector('direction direction-type words')
    ?.textContent?.trim();
  return words || null;
}

function readKey(doc: Document): string | null {
  const keyEl = doc.querySelector('attributes key');
  if (!keyEl) return null;

  // Non-traditional key (custom accidentals, no fifths): can't name it simply.
  const fifthsText = keyEl.querySelector('fifths')?.textContent;
  if (!fifthsText) {
    return keyEl.querySelector('key-step') ? 'Non-standard key' : null;
  }

  const fifths = Number.parseInt(fifthsText, 10);
  if (Number.isNaN(fifths)) return null;

  const mode = keyEl.querySelector('mode')?.textContent?.trim().toLowerCase();
  const tonic = tonicForKey(fifths, mode);

  // Unknown/atonal mode (e.g. "none"): fall back to the signature itself.
  if (!tonic) return describeSignature(fifths);

  const label = mode && mode !== 'major' ? mode : 'major';
  return `${tonic} ${label}`;
}

function tonicForKey(fifths: number, mode: string | undefined): string | null {
  const offset = MODE_FIFTHS_OFFSET[mode ?? 'major'];
  if (offset === undefined) return null;
  return LINE_OF_FIFTHS[fifths + offset + 8] ?? null;
}

function describeSignature(fifths: number): string {
  if (fifths === 0) return 'no sharps/flats';
  const n = Math.abs(fifths);
  return `${n} ${fifths > 0 ? '♯' : '♭'}`;
}

function readTempo(doc: Document): number | null {
  // Prefer the sounding tempo (drives playback); fall back to a visible mark.
  const fromSound = doc.querySelector('sound[tempo]')?.getAttribute('tempo');
  const fromMark = doc.querySelector('metronome per-minute')?.textContent;
  for (const raw of [fromSound, fromMark]) {
    if (!raw) continue;
    const n = Number.parseFloat(raw);
    if (!Number.isNaN(n)) return Math.round(n);
  }
  return null;
}
