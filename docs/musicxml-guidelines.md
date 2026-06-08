# MusicXML working guidelines (quick reference)

A practical cheat-sheet for reading/editing MusicXML in this project, distilled from the [MusicXML 4.0 spec](https://www.w3.org/2021/06/musicxml40/) (PRD §16) and verified against real pipeline output. This complements — does not replace — the feature→target table in **PRD §8** and the risks in **PRD §11**. The spec is the source of truth; when this doc and the spec disagree, the spec wins (fix this doc).

## Golden rules

- **The DOM is the model** (Invariant #1). Parse once; OSMD/overlays are views.
- **Patch, never regenerate** (Invariant #2). Mutate only the target node/attribute; preserve every optional sibling/attribute the spec allows.
- **Fidelity is measured against the normalized-on-load baseline**, not raw source bytes — `DOMParser → XMLSerializer` normalizes self-closing tags, attribute quoting, whitespace, and entities. Capture the baseline once at load (`baselineXml`).
- **`divisions` is per-measure and large** (e.g. 480, 10080). Always read `measure/attributes/divisions`; never assume 1. Durations and chord `offset` are in these units.

## Document prolog (declaration + DOCTYPE)

- `XMLSerializer.serializeToString` emits **neither** the `<?xml …?>` declaration nor the `<!DOCTYPE …>`. Real files have both.
- We capture them verbatim from the source text on parse and re-emit on serialize (`model/xmlDoc.ts`). Don't reconstruct from `doc.doctype` unless source text is unavailable.

## Key — `attributes/key`

- Traditional: `fifths` (required, −7…+7) + optional `mode` + optional `cancel`. Non-traditional: `key-step`/`key-alter`/`key-accidental` (no `fifths`).
- `mode` values: `major`, `minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `aeolian`, `ionian`, `locrian`, `none`. Absence ⇒ treat as major.
- A mode's tonic is an offset along the line of fifths from the major tonic of the same signature (see `model/scoreInfo.ts`).
- Editing (relabel): patch only `fifths`/`mode`; **preserve** `cancel`, `key-octave`, `number` (per-staff), `print-object`. Relabel does **not** move pitches.

## Harmony (chord symbols) — `harmony`

- Child order is schema-significant: `root | numeral | function` → `kind` (required) → `inversion` → `bass` → `degree`\* → `frame` → `offset` → `footnote`/`level` → `staff`.
- Root is usually `root` (`root-step` + optional `root-alter`) but may be `numeral` (Nashville) or `function` (deprecated). PoC edits `root`; never corrupt the others.
- `kind` has a fixed value enum (below) plus a `text` attribute = the displayed label (e.g. `kind="major-seventh" text="maj7"`). **Always prefer `kind/@text` for display** when present (preserve it on edit); when _we_ write a chord, set `text` to the conventional lead-sheet symbol (see "Lead-sheet conventions" below) so the chart reads professionally regardless of the renderer's default.
- Chord symbols sit **above the staff, centered over the beat where the harmony changes** (Berklee). Our overlay anchors (§7.4) must place each chord at the onset of its harmonic region, not the bar start.
- `harmony/@type` = `explicit` | `implied` | `alternate` — preserve. Also preserve `inversion`, `degree`, `frame`, positioning, `print-object`/`print-frame`.
- `offset` (divisions) places the chord within the measure; many files omit it and rely on document order (chord before the note at that beat).

**Implemented (M6a, [`commands/chord.ts`](../src/commands/chord.ts) + [`model/chordSymbol.ts`](../src/model/chordSymbol.ts) + [`overlay/ChordLayer.tsx`](../src/overlay/ChordLayer.tsx)):** add / edit / remove per-beat chords, all undoable.

- **Addressing:** a chord is located by `{measureIndex, entryIndex}` — the ordinal of the **sounding note** it attaches to within the measure (a `<harmony>` precedes its note in document order; `<chord/>`-member notes don't advance the ordinal). Commands are **measure-scoped**, so the snapshot-based `editElement` inverse round-trips insert / rewrite / remove with no special-casing.
- **Writing:** we set `root` (`root-step` + `root-alter` only when altered), `kind` (with a Berklee `@text` label; omitted for a plain major), and optional `bass`, in schema child order — **preserving** any existing `inversion`/`degree`/`frame`/`offset`/`@type`/`staff` (Invariant #2). Insertion places the `<harmony>` immediately before its note, so `schedule.ts` picks it up at the right beat with no `<offset>` needed.
- **Display vs export:** we render our **own HTML pills** (OSMD's drawn glyphs suppressed via `EngravingRules.DefaultColorChordSymbol`, `RenderChordSymbols` left on to keep the reserved chord row), and **display** every chord through the house-style formatter for a consistent chart. But `kind/@text` is only rewritten on an **explicit edit** — untouched chords export with their source `@text` verbatim.
- **House style (Berklee, B6.8):** minor=`mi`, major-seventh=`Maj7`, minor-seventh=`mi7`, half-diminished=`ø7`, diminished=`°`(`°7`), augmented=`+`, sus=`sus2`/`sus4`, sixths=`6`/`mi6`, slash=`C/E`, no-chord=`N.C.`. The typed-field parser accepts the common spellings + unicode (♯ ♭ Δ ° ø –) and maps quality → `kind-value`.
- **Out of M6a (→ M6b):** structured root/quality/bass picker, enharmonic toggle, right-click respell. Non-`root` harmonies (`numeral`/`function`) are rendered/edited as out-of-scope — preserved, never corrupted.

### `kind-value` enumeration (for the chord dropdown)

- Triads: `major`, `minor`, `augmented`, `diminished`
- Sevenths: `dominant`, `major-seventh`, `minor-seventh`, `half-diminished`, `diminished-seventh`, `augmented-seventh`, `major-minor`
- Sixths: `major-sixth`, `minor-sixth`
- Extended: `dominant-ninth`/`-11th`/`-13th`, `major-ninth`/`-11th`/`-13th`, `minor-ninth`/`-11th`/`-13th`
- Suspended: `suspended-second`, `suspended-fourth`
- Functional sixths: `French`, `German`, `Italian`, `Neapolitan`
- Other: `power`, `pedal`, `Tristan`, `none`, `other`

Suggested UI-quality → kind map: `maj→major`, `min/m→minor`, `7→dominant`, `maj7→major-seventh`, `m7→minor-seventh`, `m7♭5→half-diminished`, `dim→diminished`, `dim7→diminished-seventh`, `aug→augmented`, `sus2→suspended-second`, `sus4→suspended-fourth`, `6→major-sixth`, `9→dominant-ninth`.

## Transpose

- The `<transpose>` element (in `attributes`: `diatonic`, `chromatic` (semitones, required), `octave-change`, `double`) encodes **instrument** written-vs-sounding transposition. It is **not** a request to move pitches — leave any existing one intact.
- To actually transpose, rewrite every `note/pitch` (`step`/`alter`/`octave`) **and** `key/fifths`, with an enharmonic spelling policy. The ±n/∓n identity test (vs the load baseline) is the guard.
- **Implemented (M4, [`commands/transpose.ts`](../src/commands/transpose.ts)):** pitches move on a `(diatonic, chromatic)` coordinate (reversible: `+n`/`−n` cancel). On a chord chart the chords are the point, so `harmony` **root + bass** move too (the slash-note pitches are hidden). Spelling is **key-aware** — for the requested chromatic interval we pick the letter-step count whose resulting `fifths` has the fewest accidentals, so the key stays within ±7 (OSMD can only render ±7 — beyond it throws "key signature spec: undefined") and reads conventionally (C major +2 → D major; A major −1 → A♭ major). The `<transpose>` element is left untouched.

## Tempo

- `sound[@tempo]` = quarter-notes per minute, **drives playback**; the visible `metronome` (`beat-unit` + `per-minute`) is the **printed mark**. Keep them in sync.
- A file may have **no tempo at all** (common from the pipeline) and tempo can change mid-piece (multiple `sound`/`direction`). Playback needs a default (e.g. 120); `SetTempo` must create both at measure 1 when absent.
- **Implemented (M4, [`commands/tempo.ts`](../src/commands/tempo.ts)):** `setTempo` patches both representations and, in the partial case (only one present), **creates the missing partner** in the same `<direction>` with correct child order (all `direction-type`s precede `<sound>`). On **load**, [`model/defaults.ts`](../src/model/defaults.ts) assigns a default tempo (120 BPM) **and** key (C major) when the file has neither, surfacing a dismissible alert — so the chart is always editable/playable.

## Slashes — per-note `note/notehead` = `slash`

- **Decision (S1 spike, [`spikes.md`](./spikes.md)):** OSMD ignores `measure-style/slash` (region form); use per-note `<notehead>slash</notehead>`. This is also what the pipeline emits.
- `ToggleBarSlashes` adds/removes the `notehead` child on each note in the bar; capture the original notehead for the inverse.

## Sections & annotations — `direction/direction-type`

- Section mark = `rehearsal` (default **square** enclosure); annotation = `words` (no enclosure). Both live in `direction-type`; the parent `direction` has `placement` (above/below) and attaches to a measure.
- Moving/re-parenting (M7): preserve `enclosure`, `placement`, positioning (`default-x/y`, `relative-x/y`), and text-formatting attributes.

## Lead-sheet conventions (Berklee)

Source: [Berklee Today — "The Lead Sheet"](https://www.berklee.edu/berklee-today/summer-2018/lead-sheet). A lead sheet's job is "just enough information for everyone to be on the same page." Our files are specifically **chord charts** (slashes + chord symbols, no melody) — a chart _without_ melody is a chord chart, not a lead sheet.

- **Chord-symbol spelling (set via `kind/@text`):** minor = `mi` / `min` / `–` (not bare `m`, which reads ambiguously next to `M`/`Maj`); major-seventh = `Maj7` / `Ma7`; augmented = `+`; diminished = `°`; half-diminished = `ø`; suspended = `sus4` / `sus2`; tensions/alterations in parentheses, e.g. `C7(♯11)`; alternate bass / slash chords as `C/E` (`harmony/bass`). Be consistent across the chart.
- **Road map / navigation** (what keeps a chart to one page): repeat barlines, multiple endings (`ending`), `segno`/`coda` + `D.S.`/`D.C.` jumps, and text directions like "Play 4×" / "Vamp out" (`words`). **PoC: preserve these verbatim and render them** (OSMD handles repeats/endings/coda/segno); _editing_ the road map is post-MVP. Our free-text annotations (`words`) already cover "Play 4×"-style directions.
- **Style / feel marking:** a chart should carry a style indication (e.g. "Medium Swing", "Bossa", "Ballad") alongside the tempo — usually a `words` direction near the top. **Implemented (M1):** read as the first `words` direction in measure 1, shown as the header "Feel" chip (`model/scoreInfo.ts`).
- **Legibility:** lead sheets favor a small, consistent number of bars per line (commonly ~4 in 4/4) and one page. **Implemented (M1):** `RenderXMeasuresPerLineAkaSystem = 4`, with `NewSystemAtXMLNewSystemAttribute` so explicit `<print new-system="yes">` / `new-page` breaks from the source still take effect.
- **Slash rhythm:** `////` (one slash per beat) with chords above is the rhythm-section convention — exactly our per-note `<notehead>slash</notehead>` (above).
