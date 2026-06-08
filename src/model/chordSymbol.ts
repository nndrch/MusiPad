/**
 * Chord-symbol model (PRD §8, §9 M6) — the pure string↔spec↔DOM core of the
 * chord editor. No DOM mutation here (commands own that, `commands/chord.ts`);
 * this is parsing, Berklee-house-style formatting, and reading a `<harmony>`.
 *
 * Three directions, all routed through `ChordSpec`:
 *   • **parse** typed text ("Em7", "F#m7b5", "C/E", "BbMaj7") → `ChordSpec`
 *   • **format** a `ChordSpec` → the displayed lead-sheet symbol (Berklee house
 *     style: minor=`mi`, maj7=`Maj7`, `°`, `ø`, `+`, `sus`, slash `C/E`)
 *   • **read** an existing `<harmony>` element → `ChordSpec`
 *
 * House style (B6.8, guidelines §Lead-sheet conventions): we always *display*
 * chords through `formatChordSymbol` so the whole chart reads consistently, and
 * on edit we *write* the same convention to `kind/@text`. The pipeline's raw
 * `@text` on chords we never touch is preserved on export (Invariant #2) — only
 * an explicit edit rewrites it.
 */

/** A parsed chord, renderer- and DOM-agnostic. */
export interface ChordSpec {
  /** Root note letter A–G (upper-case), or '' for an explicit "no chord". */
  rootStep: string;
  /** Root chromatic alteration in semitones (−2…+2; 0 = natural). */
  rootAlter: number;
  /** MusicXML `kind-value` (e.g. `major`, `minor-seventh`, `none`). */
  kind: string;
  /** Optional slash-chord bass letter (A–G). */
  bassStep?: string;
  /** Bass alteration in semitones (only meaningful with `bassStep`). */
  bassAlter?: number;
}

/** Diatonic letters in chart order, for the root picker (M6b) and validation. */
export const ROOT_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * `kind-value` → Berklee quality suffix (the text after the root). `major` is
 * an empty suffix (a bare "C"); the rest follow the house style. Used both for
 * the displayed pill and for the `kind/@text` we write on edit.
 */
const KIND_QUALITY_LABEL: Record<string, string> = {
  major: '',
  minor: 'mi',
  augmented: '+',
  diminished: '°',
  dominant: '7',
  'major-seventh': 'Maj7',
  'minor-seventh': 'mi7',
  'half-diminished': 'ø7',
  'diminished-seventh': '°7',
  'augmented-seventh': '+7',
  'major-minor': 'mi(Maj7)',
  'major-sixth': '6',
  'minor-sixth': 'mi6',
  'dominant-ninth': '9',
  'major-ninth': 'Maj9',
  'minor-ninth': 'mi9',
  'dominant-11th': '11',
  'major-11th': 'Maj11',
  'minor-11th': 'mi11',
  'dominant-13th': '13',
  'major-13th': 'Maj13',
  'minor-13th': 'mi13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
  pedal: ' pedal',
  none: 'N.C.',
  other: '',
};

/**
 * Lower-cased quality token → `kind-value` for the parser. Keys are matched
 * against the *whole* quality string (after the root) once symbol characters
 * are normalised to ASCII (see `normaliseQuality`). The two genuinely
 * case-sensitive tokens — bare `m` (minor) and capital-`M` major shorthands —
 * are handled before this lookup.
 */
const QUALITY_TO_KIND: Record<string, string> = {
  '': 'major',
  maj: 'major',
  major: 'major',
  min: 'minor',
  mi: 'minor',
  '-': 'minor',
  dim: 'diminished',
  aug: 'augmented',
  '+': 'augmented',
  '7': 'dominant',
  dom7: 'dominant',
  maj7: 'major-seventh',
  ma7: 'major-seventh',
  major7: 'major-seventh',
  m7: 'minor-seventh',
  min7: 'minor-seventh',
  mi7: 'minor-seventh',
  '-7': 'minor-seventh',
  m7b5: 'half-diminished',
  min7b5: 'half-diminished',
  mi7b5: 'half-diminished',
  '-7b5': 'half-diminished',
  halfdim: 'half-diminished',
  dim7: 'diminished-seventh',
  '+7': 'augmented-seventh',
  aug7: 'augmented-seventh',
  '7#5': 'augmented-seventh',
  mmaj7: 'major-minor',
  minmaj7: 'major-minor',
  mimaj7: 'major-minor',
  '-maj7': 'major-minor',
  '6': 'major-sixth',
  m6: 'minor-sixth',
  min6: 'minor-sixth',
  mi6: 'minor-sixth',
  '-6': 'minor-sixth',
  '9': 'dominant-ninth',
  maj9: 'major-ninth',
  ma9: 'major-ninth',
  m9: 'minor-ninth',
  min9: 'minor-ninth',
  mi9: 'minor-ninth',
  '-9': 'minor-ninth',
  '11': 'dominant-11th',
  maj11: 'major-11th',
  m11: 'minor-11th',
  min11: 'minor-11th',
  '-11': 'minor-11th',
  '13': 'dominant-13th',
  maj13: 'major-13th',
  m13: 'minor-13th',
  min13: 'minor-13th',
  '-13': 'minor-13th',
  sus: 'suspended-fourth',
  sus4: 'suspended-fourth',
  sus2: 'suspended-second',
  '5': 'power',
  power: 'power',
};

/** Capital-`M` major shorthands — case-sensitive, checked before lowercasing. */
const CAPITAL_M_KIND: Record<string, string> = {
  M: 'major',
  M6: 'major-sixth',
  M7: 'major-seventh',
  M9: 'major-ninth',
  M11: 'major-11th',
  M13: 'major-13th',
};

/** Spellings that mean an explicit "no chord" (kind `none`, no root). */
const NO_CHORD = new Set(['nc', 'n.c.', 'none', 'nochord', 'no chord']);

/** Format a root/bass note: letter + unicode accidental(s). C, F♯, B♭, G𝄪. */
export function formatRoot(step: string, alter: number): string {
  if (!step) return '';
  return step.toUpperCase() + accidentalGlyphs(alter);
}

/** Berklee quality suffix for a `kind-value` (the part after the root). */
export function qualityLabel(kind: string): string {
  return KIND_QUALITY_LABEL[kind] ?? '';
}

/**
 * The full displayed chord symbol for a spec — root + quality + optional slash
 * bass. "E minor" → `Emi`, "C dominant" → `C7`, "C major / E" → `C/E`,
 * "no chord" → `N.C.`.
 */
export function formatChordSymbol(spec: ChordSpec): string {
  if (spec.kind === 'none' || !spec.rootStep) return 'N.C.';
  let s = formatRoot(spec.rootStep, spec.rootAlter) + qualityLabel(spec.kind);
  if (spec.bassStep) {
    s += '/' + formatRoot(spec.bassStep, spec.bassAlter ?? 0);
  }
  return s;
}

/**
 * Parse a typed chord symbol to a `ChordSpec`, or `null` if it can't be
 * recognised (so the editor can disable Add/Update on invalid input rather than
 * writing garbage). Accepts common lead-sheet spellings and unicode symbols
 * (♯ ♭ Δ ° ø –). Examples: `Em7`, `F#m7b5`, `BbMaj7`, `C/E`, `Asus4`, `N.C.`.
 */
export function parseChordSymbol(text: string): ChordSpec | null {
  const raw = text.trim();
  if (raw === '') return null;
  if (NO_CHORD.has(raw.toLowerCase())) {
    return { rootStep: '', rootAlter: 0, kind: 'none' };
  }

  // Split off an optional slash bass first ("C7/E" → quality "7", bass "E").
  const slash = raw.indexOf('/');
  const head = slash >= 0 ? raw.slice(0, slash) : raw;
  const bassText = slash >= 0 ? raw.slice(slash + 1) : '';

  const root = parseNote(head);
  if (!root) return null;

  const kind = parseQuality(root.rest);
  if (kind === null) return null;

  const spec: ChordSpec = {
    rootStep: root.step,
    rootAlter: root.alter,
    kind,
  };

  if (bassText) {
    const bass = parseNote(bassText);
    // A trailing '/' with no/invalid bass is a typo → reject the whole symbol.
    if (!bass || bass.rest !== '') return null;
    spec.bassStep = bass.step;
    spec.bassAlter = bass.alter;
  }

  return spec;
}

/**
 * Parse just the leading note of a typed string → `{rootStep, rootAlter}`, or
 * `null` if it doesn't start with a note. Lets the editor's combobox derive the
 * root (and offer that root's qualities) while the full symbol is still typed.
 */
export function parseLeadingRoot(
  text: string,
): { rootStep: string; rootAlter: number } | null {
  const n = parseNote(text.trim());
  return n ? { rootStep: n.step, rootAlter: n.alter } : null;
}

/**
 * Read an existing `<harmony>` into a `ChordSpec`, or `null` when the root is a
 * `numeral`/`function` (Nashville/figured-bass) we don't edit — those are
 * preserved untouched (guidelines §Harmony), never corrupted.
 */
export function readChordSpec(harmony: Element): ChordSpec | null {
  const rootStep = harmony
    .querySelector('root > root-step')
    ?.textContent?.trim()
    .toUpperCase();
  const kind = harmony.querySelector('kind')?.textContent?.trim().toLowerCase();

  if (!rootStep) {
    // No editable root: an explicit "none" still renders as N.C.; numeral/
    // function roots are out of scope and reported as null.
    if (kind === 'none') return { rootStep: '', rootAlter: 0, kind: 'none' };
    return null;
  }

  const spec: ChordSpec = {
    rootStep,
    rootAlter: intOr(
      harmony.querySelector('root > root-alter')?.textContent,
      0,
    ),
    kind: kind || 'major',
  };

  const bassStep = harmony
    .querySelector('bass > bass-step')
    ?.textContent?.trim()
    .toUpperCase();
  if (bassStep) {
    spec.bassStep = bassStep;
    spec.bassAlter = intOr(
      harmony.querySelector('bass > bass-alter')?.textContent,
      0,
    );
  }

  return spec;
}

/** An existing chart chord, located by the slash it sits on (for the overlay). */
export interface ChartChord {
  /** 0-based measure index in the primary part. */
  measureIndex: number;
  /** 0-based ordinal of the sounding note this chord attaches to (the anchor). */
  entryIndex: number;
  spec: ChordSpec;
  /** Berklee-house-style display text for the pill. */
  text: string;
}

/**
 * Every editable chord in the chart, addressed by `{measureIndex, entryIndex}`
 * — the same coordinates `commands/chord.ts` and the overlay anchors use. A
 * `<harmony>` attaches to the next sounding note (it precedes it in document
 * order); chord-member notes (`<chord/>`) don't advance the ordinal. Chords with
 * a non-`root` source (numeral/function) are skipped (not editable here).
 */
export function readChartChords(doc: Document): ChartChord[] {
  const part = doc.querySelector('part');
  if (!part) return [];
  const chords: ChartChord[] = [];

  part.querySelectorAll(':scope > measure').forEach((measure, measureIndex) => {
    let entryIndex = 0;
    let pending: Element | null = null;
    for (const el of Array.from(measure.children)) {
      if (el.tagName === 'harmony') {
        pending = el; // attaches to the next sounding note
      } else if (el.tagName === 'note') {
        if (el.querySelector(':scope > chord')) continue; // chord member
        if (pending) {
          const spec = readChordSpec(pending);
          if (spec) {
            chords.push({
              measureIndex,
              entryIndex,
              spec,
              text: formatChordSymbol(spec),
            });
          }
          pending = null;
        }
        entryIndex++;
      }
    }
  });

  return chords;
}

// — internals —————————————————————————————————————————————————————————————

/** Unicode accidental glyph(s) for a semitone alteration (−2…+2). */
function accidentalGlyphs(alter: number): string {
  if (alter === 0) return '';
  if (alter === 2) return '𝄪';
  if (alter === -2) return '♭♭';
  const glyph = alter > 0 ? '♯' : '♭';
  return glyph.repeat(Math.min(Math.abs(alter), 3));
}

/** Parse a leading note (letter + accidentals); returns the rest for quality. */
function parseNote(
  s: string,
): { step: string; alter: number; rest: string } | null {
  const m = /^([A-Ga-g])([#♯b♭x𝄪𝄫]*)(.*)$/u.exec(s.trim());
  if (!m) return null;
  const step = m[1].toUpperCase();
  let alter = 0;
  for (const ch of m[2]) {
    if (ch === '#' || ch === '♯') alter += 1;
    else if (ch === 'b' || ch === '♭') alter -= 1;
    else if (ch === 'x' || ch === '𝄪') alter += 2;
    else if (ch === '𝄫') alter -= 2;
  }
  return { step, alter, rest: m[3].trim() };
}

/** Normalise symbol characters in a quality string to ASCII tokens. */
function normaliseQuality(q: string): string {
  return q
    .replace(/[–—−]/g, '-') // dashes → hyphen-minor
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/Δ7|Δ/g, 'maj7') // triangle = major-seventh
    .replace(/°7|o7/g, 'dim7')
    .replace(/°/g, 'dim')
    .replace(/ø7|ø/g, 'm7b5')
    .replace(/\s+/g, '')
    .replace(/[()]/g, ''); // tolerate parens around alterations, e.g. m7(b5)
}

/** Resolve a quality string (after the root) to a `kind-value`, or null. */
function parseQuality(q: string): string | null {
  if (q === '') return 'major';
  if (q === 'm') return 'minor'; // bare lower-m = minor (vs capital M = major)
  if (q in CAPITAL_M_KIND) return CAPITAL_M_KIND[q];
  const key = normaliseQuality(q).toLowerCase();
  if (key === '') return 'major';
  return QUALITY_TO_KIND[key] ?? null;
}

function intOr(text: string | null | undefined, fallback: number): number {
  if (text == null) return fallback;
  const n = Number.parseInt(text, 10);
  return Number.isNaN(n) ? fallback : n;
}
