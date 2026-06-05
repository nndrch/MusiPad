/**
 * Read-only summary of a score for the header (Key, Tempo/BPM). Derived from
 * the MusicXML DOM — the single source of truth (Invariant #1). M4 makes these
 * editable; for now they are display-only.
 */
export interface ScoreInfo {
  /** e.g. "G major", "E minor", or null if no key is written. */
  key: string | null;
  /** Quarter-notes per minute, or null if none is written. */
  tempo: number | null;
}

// fifths → tonic, for major keys and their relative minors.
const MAJOR_TONICS: Record<number, string> = {
  [-7]: 'C♭',
  [-6]: 'G♭',
  [-5]: 'D♭',
  [-4]: 'A♭',
  [-3]: 'E♭',
  [-2]: 'B♭',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F♯',
  7: 'C♯',
};
const MINOR_TONICS: Record<number, string> = {
  [-7]: 'A♭',
  [-6]: 'E♭',
  [-5]: 'B♭',
  [-4]: 'F',
  [-3]: 'C',
  [-2]: 'G',
  [-1]: 'D',
  0: 'A',
  1: 'E',
  2: 'B',
  3: 'F♯',
  4: 'C♯',
  5: 'G♯',
  6: 'D♯',
  7: 'A♯',
};

export function readScoreInfo(doc: Document): ScoreInfo {
  return { key: readKey(doc), tempo: readTempo(doc) };
}

function readKey(doc: Document): string | null {
  const fifthsText = doc.querySelector('attributes key fifths')?.textContent;
  if (!fifthsText) return null;
  const fifths = Number.parseInt(fifthsText, 10);
  if (Number.isNaN(fifths)) return null;

  const mode = doc
    .querySelector('attributes key mode')
    ?.textContent?.trim()
    .toLowerCase();
  const minor = mode === 'minor';
  const tonic = (minor ? MINOR_TONICS : MAJOR_TONICS)[fifths];
  if (!tonic) return null;
  return `${tonic} ${minor ? 'minor' : 'major'}`;
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
