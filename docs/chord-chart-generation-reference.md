# Generating Chord Charts in MusicXML — Authoring Reference

A self-contained guide for a tool that turns an **audio file → a chord chart** and emits **MusicXML 4.0**. It distills two references into concrete authoring rules:

- **MusicXML 4.0 (W3C):** https://www.w3.org/2021/06/musicxml40/ — element structure, child order, data-type enumerations (normative).
- **Lead-sheet conventions (Berklee Today, "The Lead Sheet"):** https://www.berklee.edu/berklee-today/summer-2018/lead-sheet — chord-symbol spelling, road map, legibility.

> **Chord chart vs. lead sheet.** A _lead sheet_ has a single-line **melody** + chords + (often) lyrics. A _chord chart_ has **rhythm slashes** + chord symbols and **no melody** — this is what an audio→chart tool produces. Everything below targets the chord-chart case.

The chart's job (Berklee): _"just enough information for everyone to be on the same page so they can develop a unique interpretation together."_ Optimize for clarity and one page, not engraving perfection.

---

## 1. What a generated chart must contain

From a typical audio-analysis pipeline (chord recognition, beat/downbeat tracking, key & tempo estimation, structural segmentation) you have the inputs on the left; write them as the MusicXML on the right.

| Analysis output                     | MusicXML target                                   | Section |
| ----------------------------------- | ------------------------------------------------- | ------- |
| Key estimate                        | `attributes/key/fifths` (+ `mode`)                | §4.4    |
| Tempo (BPM)                         | `direction/sound[@tempo]` + visible `metronome`   | §4.9    |
| Meter / time signature              | `attributes/time/beats` + `beat-type`             | §4.5    |
| Beat & downbeat grid                | `measure`s + `attributes/divisions` + note onsets | §4.3    |
| Chord labels per beat/bar           | `harmony` (`root` + `kind` (+ `bass`))            | §4.7    |
| Rhythm (the chart "notes")          | per-beat `note` with `<notehead>slash</notehead>` | §4.8    |
| Section boundaries (verse/chorus/…) | `direction/direction-type/rehearsal`              | §4.10   |
| Repeats / form / road map           | `barline/repeat`, `ending`, `segno`/`coda`        | §4.11   |
| Style / feel (optional)             | `direction/direction-type/words` near the top     | §4.10   |
| Layout (≈4 bars/line)               | `print` system/page breaks                        | §4.12   |

---

## 2. Document skeleton (copy-paste template)

A complete, valid 4-bar chord chart. Emit the **XML declaration and the DOCTYPE** — they are required for a well-formed, portable MusicXML file (many serializers drop them; don't).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>Song Title</work-title>
  </work>
  <identification>
    <encoding>
      <software>YourGenerator 1.0</software>
      <encoding-date>2026-06-05</encoding-date>
      <supports element="accidental" type="yes"/>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Chart</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><words>Medium Swing</words></direction-type>
      </direction>
      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type>
        <sound tempo="120"/>
      </direction>
      <direction placement="above">
        <direction-type><rehearsal>Verse</rehearsal></direction-type>
      </direction>
      <harmony>
        <root><root-step>C</root-step></root>
        <kind text="">major</kind>
      </harmony>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
    </measure>
    <measure number="2">
      <harmony>
        <root><root-step>A</root-step></root>
        <kind text="m">minor</kind>
      </harmony>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
    </measure>
    <measure number="3">
      <harmony>
        <root><root-step>F</root-step></root>
        <kind text="maj7">major-seventh</kind>
      </harmony>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
    </measure>
    <measure number="4">
      <harmony>
        <root><root-step>G</root-step></root>
        <kind text="7">dominant</kind>
        <bass><bass-step>B</bass-step></bass>
      </harmony>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><notehead>slash</notehead></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>
```

---

## 3. Golden rules for a generator

- **Emit the prolog.** Always write the `<?xml … ?>` declaration and the MusicXML `<!DOCTYPE …>`.
- **Respect child order.** MusicXML elements are sequence-typed: children must appear in the schema-defined order or the file is invalid (see each element below). This is the #1 source of "invalid MusicXML" bugs.
- **Quantize to the grid.** Snap detected chord changes and onsets to beats/bars before writing; an unquantized chart is unreadable. Decide your `divisions` up front (§4.3).
- **One chord region = one `harmony`.** Write a `harmony` only where the chord _changes_ (at the beat it begins), not once per beat.
- **Slashes carry rhythm, not pitch.** The notes are placeholders on a fixed staff line; their pitch is irrelevant (use `B4`). Use `<notehead>slash</notehead>` per beat.
- **Be consistent.** Same chord-symbol style, same slash treatment, throughout (Berklee).
- **Aim for one page.** Use sections, repeats, and ~4 bars/line to keep it concise.

---

## 4. Element-by-element authoring

### 4.1 Root: `score-partwise`

Use the **partwise** form (measures nested in one part) — it's what chart tools and renderers expect. Set `version="4.0"`.

### 4.2 Header: `work`, `identification`

- `work/work-title` — the song title.
- `identification/encoding/software` + `encoding-date` — stamp your tool/date. Avoid writing a meaningless `creator`/composer (some libraries write their own name here; a renderer will print it).

### 4.3 `divisions` (the rhythmic grid)

- `attributes/divisions` = **ticks per quarter note** for that measure (a "PPQ"). All `duration` values are in these ticks.
- Choose the smallest value that represents your finest subdivision. For a beat-level slash chart in 4/4, `divisions=1` (quarter = 1) or `divisions=4` (sixteenth resolution) is plenty. Pipelines that need exotic tuplets use large LCM values (e.g. 480, 10080) — fine, but unnecessary for slashes.
- A quarter-note duration = `divisions`; a half = `2×divisions`; an eighth = `divisions/2`. A full 4/4 bar = `4×divisions`.
- `divisions` only needs to be re-declared in a measure where it changes.

### 4.4 Key: `attributes/key`

- Traditional: `fifths` (−7…+7; sharps positive, flats negative) + optional `mode`.
- `mode` ∈ `major`, `minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `aeolian`, `ionian`, `locrian`, `none`. From a key estimator, write `major`/`minor` (most common). For modal estimates, set the matching mode.
- `fifths` is the **signature**, independent of mode: C major and A minor both have `fifths=0`; E minor / G major both `fifths=1`. Map your key estimate (tonic + major/minor) to the right `fifths`.
- Non-traditional / atonal: omit `fifths`, use `key-step`/`key-alter` — rarely needed for charts.

Tonic → `fifths` (major): C=0, G=1, D=2, A=3, E=4, B=5, F♯=6, C♯=7, F=−1, B♭=−2, E♭=−3, A♭=−4, D♭=−5, G♭=−6, C♭=−7. For a **minor** key, use the relative major's `fifths` (A minor → 0, E minor → 1, …) and write `<mode>minor</mode>`.

### 4.5 Time signature: `attributes/time`

`<time><beats>4</beats><beat-type>4</beat-type></time>`. From a meter estimate. Common: 4/4, 3/4, 6/8. Re-declare only on change.

### 4.6 Clef: `attributes/clef`

Charts conventionally show a treble clef: `<clef><sign>G</sign><line>2</line></clef>`. (It's largely decorative on a slash chart, but include it.)

### 4.7 Chords: `harmony`

The core of the chart. One `harmony` per chord change, placed **before** the note at the beat where it starts.

**Child order (significant):** `root | numeral | function` → `kind` (**required**) → `inversion` → `bass` → `degree`\* → `frame` → `offset` → `staff`.

- **Root:** `<root><root-step>C</root-step><root-alter>1</root-alter></root>` (`root-alter` = −1 flat, 1 sharp; omit if natural). Use `root` (letter-name) for pop/chart notation. (`numeral` is for Roman/Nashville; `function` is deprecated.)
- **`kind`** (required): one value from the enum (§5) describing the chord quality. Add a `text` attribute = the **displayed symbol** (§6) so the chart reads professionally regardless of renderer: `<kind text="maj7">major-seventh</kind>`.
- **`bass`** (slash chords): `<bass><bass-step>E</bass-step><bass-alter>0</bass-alter></bass>` → renders `C/E`.
- **`offset`** (divisions): only if the chord starts mid-measure off the beat the note grid implies; usually unnecessary if you place `harmony` right before the on-beat note.
- **`harmony/@type`**: `explicit` (printed), `implied`, or `alternate`. Use `explicit` for a generated chart.
- "No chord" (your detector's `N`): write no `harmony` for that span, or `<kind>none</kind>` if you must mark it.

### 4.8 Rhythm slashes: `note` + `<notehead>slash</notehead>`

Write one `note` per beat (or per detected hit), each a slash:

```xml
<note>
  <pitch><step>B</step><octave>4</octave></pitch>
  <duration>4</duration>
  <type>quarter</type>
  <notehead>slash</notehead>
</note>
```

- `duration` is in `divisions` ticks; `type` is the visual note value (`quarter`, `eighth`, …). They must agree.
- The pitch is a placeholder (B4, the middle line in treble) — slash noteheads don't convey pitch.
- **Renderer note:** the per-note `<notehead>slash</notehead>` form is the most widely supported. MusicXML also defines a region form, `attributes/measure-style/slash` (`type="start"`/`"stop"`), but some renderers (e.g. OpenSheetMusicDisplay) ignore it. Prefer per-note slashes for portability.
- Beats with silence: use `<rest/>` instead of `<pitch>`.
- Durations in a measure must sum to a full bar (`beats × divisions × 4 / beat-type`).

### 4.9 Tempo: `sound[@tempo]` + `metronome`

Two distinct things — write both and keep them equal:

```xml
<direction placement="above">
  <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type>
  <sound tempo="120"/>
</direction>
```

- `sound[@tempo]` = quarter-notes per minute; this **drives playback**. `metronome` is the **printed mark** (display only).
- Put the initial tempo in measure 1. Tempo changes mid-piece = additional `direction`s with `sound[@tempo]` at those measures.

### 4.10 Sections & text: `direction/direction-type`

- **Section mark** = `rehearsal` (default **square** box): `<direction placement="above"><direction-type><rehearsal>Chorus</rehearsal></direction-type></direction>`, placed at the **start of the measure** where the section begins (from your structural segmentation). Typical labels: Intro, Verse, Chorus, Bridge, Solo, Outro.
- **Style / feel** = `words` near the top: `<words>Medium Swing</words>` (or Ballad, Bossa, Funk…).
- **Performance text** (e.g. "Play 4×", "Vamp out") = `words` directions too.

### 4.11 Road map: barlines, repeats, endings, navigation

Keep the chart short by writing the form rather than repeating bars.

```xml
<!-- Start of a repeated section -->
<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
<!-- End of a repeated section -->
<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>
```

- **Multiple endings:** `<barline location="left"><ending number="1" type="start"/></barline>` … `<barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>`, then a `number="2"` `type="start"`/`discontinue` ending.
- **Segno / Coda / D.S. / D.C.:** `direction/direction-type/segno` and `/coda`; jumps via `sound[@dalsegno|@dacapo|@tocoda]` + a `words`/`coda` mark.
- **Final barline:** `<barline location="right"><bar-style>light-heavy</bar-style></barline>` on the last measure.

### 4.12 Layout: `print` (≈4 bars/line)

Lead sheets favor ~4 bars per line and one page. Force a line break by making `print` the **first child** of a measure:

```xml
<measure number="5">
  <print new-system="yes"/>
  …
</measure>
```

Use `new-page="yes"` for a page break. Renderers honor these; without them they auto-break by density.

---

## 5. `kind-value` enumeration (chord qualities)

Every `kind` must be one of these (MusicXML 4.0). Pair it with a conventional `text` (§6).

- **Triads:** `major`, `minor`, `augmented`, `diminished`
- **Sevenths:** `dominant`, `major-seventh`, `minor-seventh`, `half-diminished`, `diminished-seventh`, `augmented-seventh`, `major-minor`
- **Sixths:** `major-sixth`, `minor-sixth`
- **Extended:** `dominant-ninth` / `-11th` / `-13th`, `major-ninth` / `-11th` / `-13th`, `minor-ninth` / `-11th` / `-13th`
- **Suspended:** `suspended-second`, `suspended-fourth`
- **Functional sixths:** `French`, `German`, `Italian`, `Neapolitan`
- **Other:** `power` (root+5th), `pedal`, `Tristan`, `none` (no chord), `other`

Add specific alterations/tensions with `degree` children (`degree-value` + `degree-alter` + `degree-type` add/alter/subtract), e.g. a ♯11 on a dominant.

---

## 6. Chord-symbol spelling (Berklee conventions)

Set these as the `kind/@text` (and infer from `bass` for slash chords) so the printed symbol reads like a real chart:

| Quality          | Conventional symbol         | `kind` value                   |
| ---------------- | --------------------------- | ------------------------------ |
| Major triad      | `C` (often no suffix)       | `major`                        |
| Minor            | `Cmi` / `C–` (not bare `m`) | `minor`                        |
| Augmented        | `C+`                        | `augmented`                    |
| Diminished       | `C°`                        | `diminished`                   |
| Dominant 7th     | `C7`                        | `dominant`                     |
| Major 7th        | `CMaj7` / `CMa7`            | `major-seventh`                |
| Minor 7th        | `Cmi7` / `C–7`              | `minor-seventh`                |
| Half-diminished  | `Cø7`                       | `half-diminished`              |
| Diminished 7th   | `C°7`                       | `diminished-seventh`           |
| Suspended        | `Csus4` / `Csus2`           | `suspended-fourth` / `-second` |
| Sixth            | `C6`                        | `major-sixth`                  |
| Ninth            | `C9`                        | `dominant-ninth`               |
| Alterations      | in parentheses: `C7(♯11)`   | base kind + `degree`           |
| Slash / alt bass | `C/E`                       | base kind + `bass`             |

Rules of thumb (Berklee): capital `Maj`/`Ma` distinguishes **major-7th** from **minor** (`mi`/`–`); never rely on bare `m` vs `M`. Put tensions in parentheses. Be consistent across the whole chart.

---

## 7. Mapping common chord-detector labels → MusicXML

Chord-recognition outputs (Harte/`chord-extractor`/`autochord`/`madmom`-style labels like `C:maj`, `A:min7`, `G:7/3`, `N`) map as:

| Detector label | `root-step`/`-alter` | `kind` value       | `bass`      | `text`          |
| -------------- | -------------------- | ------------------ | ----------- | --------------- |
| `C:maj`        | C / —                | `major`            | —           | `` (blank)      |
| `A:min`        | A / —                | `minor`            | —           | `mi`            |
| `G:7`          | G / —                | `dominant`         | —           | `7`             |
| `C:maj7`       | C / —                | `major-seventh`    | —           | `Maj7`          |
| `D:min7`       | D / —                | `minor-seventh`    | —           | `mi7`           |
| `B:hdim7`      | B / —                | `half-diminished`  | —           | `ø7`            |
| `E:dim`        | E / —                | `diminished`       | —           | `°`             |
| `F:sus4`       | F / —                | `suspended-fourth` | —           | `sus4`          |
| `C:maj/3`      | C / —                | `major`            | E (the 3rd) | (renders `C/E`) |
| `Bb:7`         | B / −1               | `dominant`         | —           | `7`             |
| `N` (no chord) | — (omit `harmony`)   | —                  | —           | —               |

Notes:

- Split `ROOT:quality/bass` → root, quality, optional bass scale-degree. Resolve a numeric bass (`/3`, `/5`) to the actual pitch within the chord.
- Accidental in the root → `root-alter` (`-1` flat, `1` sharp). Choose enharmonic spelling to match the key where possible.
- Detector qualities you don't recognize: fall back to the nearest enum value (e.g. unknown extended → `dominant`/`major`/`minor` base) rather than emitting an invalid `kind`.

---

## 8. From audio to bars (quantization)

1. **Beats & downbeats** → measure boundaries. Group beats by downbeat into measures of `beats` per bar (from the meter). Each beat becomes one slash note.
2. **`divisions`** → pick once (e.g. 4). Each beat's slash gets `duration = divisions`, `type = quarter` (in 4/4).
3. **Chord track** → snap each chord change to the nearest beat/bar; emit a `harmony` at that beat. Hold the chord (no new `harmony`) until the next change.
4. **Key/tempo/meter** → write into measure 1's `attributes` + tempo `direction`.
5. **Sections** → snap each boundary to a downbeat; emit a `rehearsal` at that measure.
6. **Pickup/anacrusis** → a short first measure with `<measure number="0" implicit="yes">` and a matching short duration sum.

---

## 9. Validation & fidelity checklist

Before shipping a generated file:

- [ ] **Well-formed XML** and starts with the `<?xml …?>` declaration + MusicXML `<!DOCTYPE …>`.
- [ ] **Validates** against the MusicXML 4.0 DTD/schema (child order correct everywhere).
- [ ] Every `harmony` has a `kind`; `kind` value is in the §5 enum; `root-step` is A–G.
- [ ] Per-measure `duration` sums equal a full bar; `duration` and `type` agree given `divisions`.
- [ ] Slashes use per-note `<notehead>slash</notehead>` (portable), not only `measure-style/slash`.
- [ ] `sound[@tempo]` and the visible `metronome` agree.
- [ ] Section `rehearsal` marks sit at measure starts; chord changes at the beat they begin.
- [ ] Opens correctly in at least two renderers (e.g. MuseScore + a web renderer) and round-trips.

---

## 10. References

- MusicXML 4.0 (W3C): https://www.w3.org/2021/06/musicxml40/
  - [`harmony`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harmony/) · [`kind` values](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/kind-value/) · [`key`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key/) · [`metronome`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/metronome/) · [`slash`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/slash/) · [`rehearsal`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rehearsal/) · [`barline`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/barline/)
- Berklee Today — "The Lead Sheet": https://www.berklee.edu/berklee-today/summer-2018/lead-sheet
