# Post-MVP improvements

A parking lot for work to pick up **after** the PoC/MVP milestones (PRD §9, M0–M15) are complete. These are deliberately out of scope for the MVP — captured here so they aren't lost. Not prioritized; not committed to a milestone.

---

## P1 — Refine the score's visual design

Make the rendered score feel like a deliberately designed document rather than default OSMD output — consistent with the "notepad, by way of Notion" language (PRD §6.1).

**Scope / ideas:**

- **Custom fonts.**
  - _Music (engraving) font_ — evaluate alternatives to OSMD's default (e.g. Bravura / Petaluma / Leland) and pin one. Petaluma gives a hand-written, lead-sheet feel that may suit a chord-chart tool; Leland is cleaner/modern. Bundle the font + glyph metadata locally (no CDN).
  - _Text font_ — align the score's text elements (title, chord symbols, rehearsal/section marks, annotations) with the app UI font stack (`--font-ui`) so the page reads as one design, not two.
- **Typography fine-tuning.**
  - Chord-symbol size, weight, and vertical position relative to the staff.
  - Section (rehearsal) mark styling — sections are now HTML overlay pills positioned by MusiPad ([`MarkLayer.tsx`](../src/overlay/MarkLayer.tsx), shipped M7), no longer nudged via OSMD's fixed `RehearsalMarkYOffsetDefault`; remaining work is fine-tuning the pill's size/weight/vertical position now that we own placement.
  - Title / header treatment on the paper (size, spacing, optional removal in favor of the app topbar).
  - Staff size, system spacing, and margins for a calmer rhythm on the page.

**Promoted to a milestone** (no longer deferred): the **Key · Tempo · Feel title subline → M4**. M3 removed OSMD's scattered default marks (the ♩=NN metronome + feel words) because they collided and now live in the topbar chips (`drawMetronomeMarks: false` + `buildRenderDoc` in [`useOsmd.ts`](../src/render/useOsmd.ts)); M4 renders the designed app-display replacement under the title. (Embedding it in the _printed/exported_ document remains part of P4.)

**Notes / context:**

- OSMD exposes most of this via `EngravingRules` and `IOSMDOptions` (font family, `ChordSymbol*`, rehearsal-mark rules, page format/margins) and supports loading custom music fonts.
- ~~Known MVP stopgap: rehearsal-mark vertical offset is a single fixed value (`RehearsalMarkYOffsetDefault`)…~~ **Resolved in M7:** sections are now draggable HTML overlays MusiPad positions itself, and the marks are stripped from the OSMD render clone (`buildRenderDoc`), so OSMD's fixed `RehearsalMarkYOffsetDefault` no longer applies — only the overlay pill's typography is left to fine-tune (above).

**Why deferred:** Visual polish, not core correction functionality. The MVP proves the load → edit → play → export loop; refined engraving comes after.

---

## P2 — Lead-sheet conventions & road map

Bring the chart closer to a professional lead sheet, per the [Berklee guidelines](https://www.berklee.edu/berklee-today/summer-2018/lead-sheet) (distilled in [`musicxml-guidelines.md`](./musicxml-guidelines.md)). The PoC already _preserves and renders_ these where present; this is about _editing/surfacing_ them.

**Scope / ideas:**

- **Road-map editing** — add/edit repeat barlines, multiple `ending`s, `segno`/`coda` + `D.S.`/`D.C.` jumps. This is what keeps a chart to one page; the PoC only preserves+renders them.
- **Chord-symbol display options** — let the user _pick_ a house style for `kind/@text` (e.g. `–` vs `mi` for minor, `Δ` vs `Maj7`), applied consistently across the chart. (The PoC already writes conventional symbols; this adds user choice.)
- **Style / feel marking — display & edit.** The feel marking (e.g. "Medium Swing") is **not mandatory**, so the MVP UI doesn't surface it: M4 removed it from the header (no topbar chip, no subline slot, no empty-state placeholder). The **reader stays in place** (`model/scoreInfo.ts` `readStyle` → `info.style`), so picking this up later is just UI: show it (where it won't clutter or read as required) and add an editor (a `words` direction near the top, per the Berklee convention below).

**Pulled into the PoC** (no longer deferred): **~4 bars/line** lead-sheet line breaking (`RenderXMeasuresPerLineAkaSystem`, honoring explicit `<print>` breaks), which landed in M1. (The style/feel marking was briefly shown in the header but is now deferred — see the bullet above.)

**Why deferred:** The PoC corrects metadata on existing charts and round-trips the road map untouched; authoring/restyling the navigation is a richer editing surface that builds on M5–M7.

---

## P3 — Playback enhancements

Build on the M2 chord-chart playback engine ([`src/audio/`](../src/audio/)). The PoC sounds chords as a sustained block voicing through a small built-in synth, with the playhead on OSMD's cursor.

**Scope / ideas:**

- **Selectable instrument / synth voice** — let the user pick the playback timbre (piano, acoustic guitar, electric guitar, electric piano, organ, …) instead of the single built-in oscillator tone. The MVP deliberately uses a self-contained Web Audio oscillator synth (zero-dependency, offline, deterministic — see [`synth.ts`](../src/audio/synth.ts)); this swaps in sampled/soundfont instruments behind the same `Synth` interface, with a picker in the transport. (A guitar voice could also motivate strummed/arpeggiated voicings rather than block chords.)
- **Mute the chord MIDI, keep the metronome — a play-along / rehearse mode.** A transport toggle that silences the realized chord audio but keeps the metronome clicking (and the M5 bar-highlight advancing). The musician plays along on their own instrument, reading the chart while the current bar highlights and the click keeps time — ideal for rehearsal. The transport already separates the two audio paths (chord scheduling vs `metronome` clicks in [`player.ts`](../src/audio/player.ts)) and the metronome toggle exists, so this is a "mute chords" switch alongside it (e.g. skip `synth.playChord` while the look-ahead loop and click scheduling run unchanged). Pairs naturally with the instrument picker above.

**Update (M13, 2026-06-16):** the audio-review reframe **supersedes synth chord playback for the transport** — M13 plays the **real stabilised recording** (PRD §6.7), so the transport no longer realizes `<harmony>` through the synth. Knock-on effects for this entry:

- The **play-along / rehearse mode** above is now effectively the **default**: the transport plays the recording with the metronome and bar-highlight following — exactly the rehearse experience. A residual "mute the recording, metronome-only" toggle is the only leftover nicety.
- The **instrument / synth voice** picker only applies if a **synthesized voice is re-introduced** alongside the recording (e.g. to audition a corrected chord against the track) — see **P20**. The synth itself survives only for the metronome click and the editor's Hear audition.

**Promoted to a milestone** (no longer deferred):

- the **full-bar playhead highlight → M5** — the entire current measure is highlighted (a soft orange `--accent-tint` wash) during playback instead of the thin-line cursor (which M5 removes), driven by the transport's `currentMeasure` and reusing M5's overlay machinery.
- **auto-scroll to follow the playhead → M5** — when playing, the highlighted bar is scrolled into view (only when it drifts outside a comfortable band, so it doesn't fight the user), working _with_ the zoom-to-fit transform. Originally deferred here for being a quality-of-life refinement; pulled into M5 by the human during the M5 UI-decisions pass since it pairs naturally with the bar-highlight playhead.

**Why deferred:** The MVP proves the headline — hearing the chords realized in the chart's rhythm. Instrument choice and follow-scroll are quality-of-life refinements on top of a working transport, not part of proving the loop.

---

## P4 — A4 PDF generation

True client-side **PDF export in A4 format** — a downloadable, paginated PDF of the rendered chart, beyond what the browser's print dialog produces.

> The simpler **Print** button (browser print via `@media print` CSS, score only) was **promoted to M7** alongside Download. This section now covers only the heavier PDF-generation half.
>
> **Update (M10, 2026-06-15):** the **paginated A4 page layout** and the **clip-free browser print** of it were **promoted to M10** (PRD §6.6) and are now **built** — the "paginated rendering" foundation below shipped as [`render/PrintView.tsx`](../src/render/PrintView.tsx) (off-screen `A4_P` OSMD) + the page-aware overlay projector. P4 is now scoped to just the **downloadable A4 PDF** (svg2pdf.js + jsPDF), which can feed off the same `PrintView` page SVGs.
>
> **Deferred from M10 (2026-06-16):**
>
> - **Exact Berklee chord-symbol parity on print.** The screen draws our own HTML pills (`Dmi7`, `CMaj7`); the print pages let OSMD ink the chords, and OSMD **ignores the MusicXML `<kind text>` override** (verified), so printed symbols use OSMD's house style (`Dm7`, `Cmaj7`). To match the pills, set OSMD's chord labels on the print instance via `EngravingRules.setChordSymbolLabelText(ChordSymbolEnum.x, 'Maj7' | 'mi' | …)` — a kind-value → `ChordSymbolEnum` → Berklee-label table (the labels already exist in [`model/chordSymbol`](../src/model/chordSymbol.ts) `qualityLabel`). Small, self-contained; cut from M10 to keep scope tight.
> - **Print slash style.** Print shows OSMD's slash **noteheads (with stems)**; the screen shows our minimal single-stroke `SlashLayer`. A print-only minimal-slash pass (or hiding stems + overlaying) could match them, but the engraved slash reads fine on paper.
>
> **Update (M12, 2026-06-16):** **Print is retired from the UI** in M12. The audio-review reframe (PRD §1) makes the corrected MusicXML (**Export**) the sole deliverable, and printing isn't this tool's job (PRD §3). `PrintView`/`print.css` stay in the tree but **dormant** (unwired from the topbar), so this P4 work — the downloadable **A4 PDF** — can still build on their off-screen `A4_P` page SVGs when picked up. The two parity items above (Berklee labels, slash stems) now apply to the **PDF**, not a live Print.

**Scope / ideas:**

- Generate a **PDF in A4 format** — the rendered chart laid out for paper (one or more A4 pages), honoring the ~4-bars/line lead-sheet layout and the document title header (Key · Tempo · Feel subline, M4). Score only: exclude the topbar/transport chrome and the playback cursor/overlays.
- **Options:** page size (A4 default, optional US Letter), margins, fit-to-page / scale.

**Notes / context:**

- OSMD renders **SVG**: rasterize/convert the SVG to PDF client-side (e.g. `svg2pdf.js` + `jsPDF`) at A4 dimensions — no backend.
- The fixed-`NATURAL_WIDTH` scaled-page model ([`useOsmd.ts`](../src/render/useOsmd.ts)/[`OsmdView.tsx`](../src/render/OsmdView.tsx)) should map cleanly onto A4 width; OSMD also has `PageFormat`/page-layout options worth evaluating.

**Paginated rendering — the shared foundation (scoped during M7, 2026-06-08):**

M7's Print is a CSS-only `@media print` that fits the single continuous OSMD SVG to the page width ([`src/print.css`](../src/print.css)). Because OSMD renders the whole score as **one tall SVG** (Endless page format — required for the on-screen zoom-to-fit + the overlay projection), the browser **slices it at page boundaries**, cutting through any system that straddles a sheet. CSS can't prevent this (`break-inside: avoid` is ignored for content taller than a page; you can't break "between systems" inside one SVG). So **M7 Print is clean only for charts that fit one page; longer charts clip across sheets** — a known, accepted MVP limitation. The proper fix is the same paginated re-render A4 PDF needs:

- A **hidden, off-screen** second OSMD instance — positioned off-screen, **not** `display:none` (VexFlow can't measure text metrics in `display:none`).
- Rendered with **`pageFormat: 'A4_P'`** (`setOptions`/`setPageFormat`) so OSMD lays the score onto A4 pages and **only breaks between systems** — no mid-system cuts; each MusicPage becomes its own `<svg>`.
- **Chords inked by OSMD**: the screen paints OSMD's chord glyphs transparent (`DefaultColorChordSymbol`) and overlays HTML pills, but the print pages have no overlay — so leave the glyphs inked and **normalize each `<harmony>`'s `kind/@text` to the Berklee house style** (`qualityLabel`, [`model/chordSymbol`](../src/model/chordSymbol.ts)) on the print **clone** so symbols match the on-screen pills. Reuse `buildRenderDoc`'s feel-words strip.
- Print CSS: `@page { size: A4; margin: … }`, show the print container, give each page `<svg>` `max-width: 100%; height: auto; break-after: page;` (modern browsers infer the SVG aspect ratio from its width/height attributes, so it scales without a `viewBox`).
- Trigger via an **async Print handler**: `await printView.prepare()` (load + render the clone) **then** `window.print()` — OSMD's async load can't be awaited inside a synchronous `beforeprint`, so the button path must render first.
- Title/subline header: either let OSMD draw the title (`drawTitle: true`) or render a first-page HTML band scaled to leave room (an A4-sized page SVG + an HTML header on the same sheet overflow — needs tuning).
- For PDF: feed the same paginated SVGs to `svg2pdf.js` + `jsPDF` at A4 dimensions.

**Why deferred:** The MVP's output of record is the corrected `.musicxml` (Export, M7/M12); a pixel-faithful A4 PDF generator (new deps, pagination) is a heavier convenience layered on top. The paginated re-render is the shared core. **(M10 built that paginated re-render for the on-screen page view; Print was retired from the UI in M12 — §3 — so P4 is now purely the downloadable PDF, feeding the same off-screen `A4_P` SVGs to svg2pdf/jsPDF.)**

---

## P5 — Edits: refinements surfaced by the M4 review

Items flagged by the M4 adversarial review and deliberately deferred — the core edits are correct and reversible (M4 AC holds); these are quality/robustness refinements.

**Scope / ideas:**

- **Disable Key/Tempo/Transpose edits while playing.** Simplest fix for the edit-during-playback behavior: while the transport is playing, disable (grey out) the Key dropdown, Transpose ± and Tempo field so an edit can't yank the schedule out from under playback. (Today an edit reloads the schedule, stopping playback and snapping the playhead to the top — see `useTransport.ts`.)
- **Or: preserve playback position across a schedule rebuild.** The richer alternative to disabling — give `Player` a reload path that keeps `playing`/`positionSec` and re-strikes the held chord at the current position, so a tempo edit takes effect mid-play (fits the **M5** transport/playhead work).
- **Extreme-key enharmonic round-trip.** Transpose is key-aware ([`transpose.ts`](../src/commands/transpose.ts) — it picks the fewest-accidental spelling, so keys stay within ±7 and read conventionally, e.g. A major ↓ = A♭ major). The one residual edge: the two extreme keys at exactly ±6/±7 fifths (F♯/G♭ and C♯/C♭ major) can round-trip (`+n` then `−n`) onto their _enharmonic equivalent_ spelling — musically identical, and these keys are practically absent from lead-sheet charts. A full respell policy (note respell, **P12**) could pin a house spelling here.
- **Preserve non-canonical numeric text.** Transpose canonicalizes `alter` text (a source `"1.0"` becomes `"1"`); key/tempo edits are similar for numeric fields. Harmless for our pipeline (canonical integers only), but a fully byte-faithful patcher would leave untouched numeric formatting intact.
- **Louder missing-data warning.** When a file loads without a key/tempo, M4 shows muted/italic empty-state placeholders ("no key", "no tempo") and the tempo field's "120" placeholder, and playback falls back to 120. A more prominent toast/banner is deferred to **M9** (toasts/empty states) since a coloured warning would break the §6.1 grayscale language used inline.

**Why deferred:** None breaks an M4 acceptance criterion; each is a refinement on top of working, reversible edits.

---

## P6 — Responsive layout for small screens

The score renders at a fixed `NATURAL_WIDTH` and scales proportionally to fit the viewport (zoom-to-fit, no reflow — [`useOsmd.ts`](../src/render/useOsmd.ts)/[`OsmdView.tsx`](../src/render/OsmdView.tsx)), which works well across desktop widths. On **small screens (small tablets / mobile)** the ~4-bars/line layout zooms down so far the chart gets hard to read.

**Scope / ideas:**

- Below a width breakpoint, **break to ~2 bars per line** (vs the default ~4) so each bar is large enough to read on a phone/small tablet. Likely a responsive `RenderXMeasuresPerLineAkaSystem` (4 → 2) driven by a `ResizeObserver`/media query, re-laying-out (not just re-scaling) at that breakpoint — and re-projecting the M5 overlay afterward.
- Consider touch-target sizing for bar selection / future chord targets at that scale.

**Why deferred:** PRD §3 lists **"No mobile-first layout (desktop browser is the target)"** as a PoC non-goal. The zoom-to-fit model already keeps the chart usable when scaled; a true small-screen reading mode is a responsiveness enhancement on top of the working desktop layout. _(Requested 2026-06-07 during the M5 build.)_ _(Relates to **M10**'s view modes — a small-screen mode is a responsive variant of the **fullscreen (continuous)** view; §6.6.)_

---

## P7 — Meter / time-signature editing

**Promoted to a milestone — M8** (M6 3-milestone re-weigh, CLAUDE.md rule 6, 2026-06-08). Scheduled as its own focused milestone after M7 rather than folded in, to keep M7 tight. Full scope + AC now live in [PRD §9 → M8](./musicxml-editor-prd.md) and [`roadmap.md`](./roadmap.md) (hover-edit the staff time signature → undoable `Command` patching `attributes/time`, re-deriving the `schedule.ts` beat math + slash grid). _No longer deferred._

## P8 — Structured chord builder (picker + enharmonic respell)

The shipped M6 chord editor is an **editable combobox** — a text field plus a **dropdown** of the current root's qualities ([`overlay/ChordEditor.tsx`](../src/overlay/ChordEditor.tsx)). It already covers every chord the MVP can express: typing parses `Em7` / `F#m7b5` / `BbMaj7` / `C/E` / `N.C.` / unicode ♯♭Δ°ø–, and the dropdown picks common qualities. _(This was the planned "M6b"; see [`ui-decisions.md`](./ui-decisions.md) decision log, 2026-06-08.)_

**Scope / ideas (if ever wanted):**

- A **structured builder** behind the editor's ▾: a **Root** selector (letter A–G + ♭/♮/♯ accidental), **Quality** buttons grouped by family over the full `kind-value` enum (triads / sixths / sevenths / sus / extended / N.C. — B6.6), and a **collapsible `/ bass`** slash picker (B6.7). Picker clicks compose the working symbol (via the field as the single source of truth) and audition it; Add/Update commits.
- **Enharmonic respell** (B6.5/B6.11): for an accidental root, a one-click `Respell → <twin>` (C♯↔D♭) that flips spelling while keeping quality/bass — backed by a pure `enharmonicAlternatives(step, alter)` helper (reusable for **note respell**, deferred to **P12**, which is where the A3 right-click context menu will first be built).

**Why deferred:** A full working prototype was built and verified (24/24 headless) on `feat/m6b-chord-picker`, then **cut on review as too complex for an MVP** — _"keep it simple as a dropdown with a list of chords"_ (2026-06-08). The dropdown stays the editor. This is recorded so the design (and the `enharmonicAlternatives` approach) isn't lost if a future, non-MVP iteration wants a richer builder.

---

## P9 — Single-note playback / audition

Today only **chords** sound — the harmonic rhythm realized as block voicings ([`schedule.ts`](../src/audio/schedule.ts)). Individual noteheads are **slash placeholders** that only step the visual playhead and are deliberately **never sounded** (PRD §3, §8: "we never play the written placeholder pitch"). This captures two distinct ways to add note-level sound. _(Requested 2026-06-08, after the M6 chord-preview fix.)_

**Scope / ideas:**

- **Click-to-audition a note** _(low-hanging)_ — click/select a notehead → hear that single pitch, mirroring the M6 chord audition. Nearly all the machinery already exists: a note is just a one-element chord, so [`previewChord([midi])`](../src/audio/player.ts) already sounds it; [`computeStaffEntries`](../src/overlay/projector.ts) already emits clickable per-notehead anchors and [`ChordLayer`](../src/overlay/ChordLayer.tsx) mounts hit-zones over them; [`nthSoundingNote`](../src/commands/chord.ts) resolves `(measureIndex, noteIndex) → <note>`; and [`voicing.ts`](../src/audio/voicing.ts) already has the step/octave/alter→MIDI conversion. The **only missing code** is a ~20-line `<note>` → MIDI reader plus one branch in the existing click handler. Estimate: ~half a day + QA. Caveat: a no-op on pure slash/`<unpitched>` placeholders — only meaningful for notes carrying a real `<pitch>`.
- **Transport plays the melody line** _(larger)_ — sound the written note line alongside the chord regions during playback. This **reverses the documented chord-chart reading** (slashes keep time but don't articulate; placeholder pitches are never played), so it needs a **PRD decision** before any code, plus schedule/playback changes to emit and sound per-note pitch events.

**Why deferred:** Beyond the MVP milestone scope (M0–M15) and the chord-chart premise the engine is built on. Captured so the (surprisingly small) audition path and the bigger melody-playback question aren't lost. Surfaced when the chord-preview-cutoff fix was being closed out.

---

## P10 — Evolve into a full lead-sheet editor (melody/note editing)

> **This is an epic / north-star, not a single deferred refinement.** It changes the product's identity — from a **chord-chart corrector** (fix the chords over a fixed slash grid; PRD §3, §8) into a **lead-sheet authoring tool** where the user also writes and edits the **melody** itself. It therefore needs a **product-level decision and its own PRD track** (a milestone series beyond M0–M15), not just a slot in an existing milestone. P9 (note playback) is the first, smallest step on this path; this entry is the whole arc. _(Requested 2026-06-08.)_

A lead sheet is **melody (pitched notes + rhythm) + chord symbols (+ optionally lyrics)**. MusiPad already owns the chord-symbol half (M6) and renders/round-trips real notation; what's missing is **editing the notes**: their pitch, their rhythm, and adding/removing them.

### Why this is more tractable than it sounds — the seams already pay off

The MVP's structural seams (Invariant #5) were built for exactly this kind of extension:

- **DOM is the single source of truth (Invariant #1)** and OSMD is a re-rendered view. A note edit is just a DOM patch followed by a re-render — no new rendering engine, no second model.
- **Every edit is a Command (Invariant #3).** Note edits become new `Command`s in [`src/commands/`](../src/commands/) alongside `chord` / `key` / `tempo` / `transpose` → **undo/redo and history come for free.**
- **Note addressing already exists.** [`nthSoundingNote(measure, noteIndex)`](../src/commands/chord.ts) (used by chord edits) is the same addressing a note edit needs to locate its `<note>`.
- **The overlay already finds noteheads.** [`computeStaffEntries`](../src/overlay/projector.ts) projects one anchor per note onset and [`ChordLayer`](../src/overlay/ChordLayer.tsx) already mounts clickable hit-zones over them — the substrate for note selection and an editor popover.
- **pitch ↔ MIDI already exists.** [`voicing.ts`](../src/audio/voicing.ts) converts `step`/`octave`/`alter` ↔ MIDI (built for harmonies) — reusable for reading, writing, and auditioning note pitches.
- **The schedule already walks every `<note>`.** [`schedule.ts`](../src/audio/schedule.ts) reads note *durations* today; extending it to read `<pitch>` is what lets the melody **sound** (the P9 transport question).

### Scope — capabilities, roughly easiest → hardest

1. **Note audition + melody playback** — see **P9**. Read note pitches; sound them on click and/or through the transport. Validates the pitch model end-to-end; lowest risk. _Prerequisite for everything below feeling real._
2. **Pitch editing (in place, no rhythm change)** — change a selected note's pitch: drag up/down a staff step or arrow-key it, with accidental control (♯/♭/♮) and **enharmonic respell** (reuses the `enharmonicAlternatives` helper deferred to **P12** / parked in **P8**). Writes `<pitch><step><octave><alter>` via a `Command`. **Local and reversible** — the measure's beat budget is untouched, so this respects Invariant #2 cleanly. Vertical hit-testing (a y on the staff → a diatonic step, given the clef + key) is the main new piece.
3. **Rhythm / duration editing + note entry — _the hard part._** Change a note's duration (`<duration>` ticks + `<type>` + dots), add a note (split a slash/rest into pitched notes), delete a note (→ rest). Unlike chord and pitch edits, **a duration change is non-local**: it shifts every following onset in the bar, and must keep the measure **beat-valid** against its `divisions` + time signature. This needs:
   - a **beat-budget / measure-rebalancing model** (durations must sum to the bar; over/under-full needs a policy — auto-rest fill, push/pull following notes, or reject the edit),
   - **beam and tie recomputation** (`<beam>`, `<tie>`/`<tied>`),
   - a **note-entry interaction** (mouse-on-staff = pitch + insertion point; or keyboard step-time; MIDI input is a later luxury), in the §6.1 "notepad calm" idiom.
   This is what separates a real lead-sheet *editor* from the current figure-level chord editor, and where most of the risk and design effort lives.
4. **Slash ↔ pitched conversion + rests** — a lead sheet routinely mixes a **notated melody** (head/verses) with **slash bars** (solos). The current engine treats every notehead as a slash placeholder; this adds distinguishing real pitched notes from slash notation (`<notehead>slash`, slash `<measure-style>`) and converting between them. Pairs with the **per-bar slash toggle** (**P11**, built and parked on a branch).
5. **Lyrics _(optional, classic lead sheet)_** — edit `<lyric>` text under notes (syllables, melismas). A natural follow-on once notes are editable; can be its own phase.

### Open questions / decisions this forces

- **Does the melody sound, and how does it relate to the chord realization?** (PRD decision — same one P9's "transport plays the melody" half raises.) Block-voiced chords + a melody line need a mix/voice/mute story (ties to **P3** instrument picker + play-along mute).
- **Reflow vs. Invariant #2.** "Patch, don't regenerate" is easy for pitch (one node) but stressed by duration edits that ripple through a bar. Define how far a single edit is allowed to rewrite, and confirm unedited *measures* still serialize byte-identical to the load baseline.
- **Interaction with upstream Basic Pitch data.** The placeholder pitches we deliberately never sounded (PRD §8) become **editable real pitches** here — decide how melody authoring coexists with the upstream note/stem metadata Invariant #2 currently protects.
- **Where the boundary is.** Lead sheet = **single melody line + chords + lyrics**. Explicitly *not* multi-voice/multi-staff/full engraving — set that non-goal up front to stop scope creep into a general notation editor.
- **Editing stays overlay + DOM + re-render.** OSMD is render-only (Invariants #1/#4); note-drag needs an overlay "ghost" preview, not OSMD mutation.

### Suggested phasing

`P9 (audition + melody playback)` → `pitch editing (local)` → `rhythm editing + note entry (beat-budget engine)` → `slash↔pitched + rests` → `lyrics`. Each phase is independently shippable and useful; the product becomes a "lead-sheet editor" somewhere around the rhythm-editing phase.

**Related:** **P9** (note playback — the first step), **P8** (enharmonic respell / `enharmonicAlternatives`, reused for pitch respell), **P7** (meter editing — shares the beat-math/`divisions` model the reflow engine needs), **P3** (instruments / play-along mute for a melody+chords mix), **P2** (lead-sheet conventions & road map).

**Why deferred:** A deliberate expansion of the product's mission well beyond the PoC/MVP (M0–M15), which proves the chord-chart *correction* loop. Recorded here as the intended evolution path so the architecture decisions made for the MVP (DOM-as-truth, command layer, per-item overlay projection) are understood as the foundation this builds on — and so the hard part (rhythm reflow) is flagged before anyone assumes "it's just chord editing for notes."

---

## P11 — Per-bar slash toggle (built, extracted from M7)

A toolbar toggle that flips the **selected bar** between slash notation (`////`, the rhythm-section comp convention) and showing its noteheads. **Fully built and verified-by-build during M7, then extracted from the MVP** (2026-06-08) — preserved on branch **`post-mvp/slash-toggle`** ([commit `3ef169a`](https://github.com/nndrch/MusiPad/commit/3ef169a)). _(Requested/extracted 2026-06-08.)_

**What exists (on the branch):**

- `commands/slashes.ts` — `setBarSlashes(measureIndex, on)` (measure-scoped, snapshot-inverse undo) toggling per-note `<notehead>slash</notehead>` (spike **S1**: OSMD ignores `measure-style/slash`; per-note notehead only), inserted in schema-valid position; durations/pitch/type untouched. Plus `barSlashState()` for the toggle's enabled/active reflection.
- `ui/Toolbar` — a "Slashes" toggle acting on the selected bar (disabled with no selection, active=accent-tint).
- `App/Score` — selected-bar slash state + toggle wiring (re-reads on each edit via `revision`).

**Update (M9, 2026-06-15):** under the simplified chord-chart view (M9, PRD §6.5) **every bar renders as slashes by default** (in the render clone), so the per-bar _toggle_ is moot for the MVP. It re-emerges only once the written melody can be _displayed_ (note display, [[P10]]) — then the toggle chooses, per bar, between comping (slashes) and a written figure (notes).

**Why deferred:** Slashes already come from the Basic Pitch pipeline, so the toggle is only a cleanup tool today; its real value — choosing per bar between *comp (slashes)* and a *written figure (notes)* — needs **note editing** ([[P10]] / P9). Cheap to revive: rebase the branch onto `main`.

## P12 — Note respell + A3 right-click context menu

Right-click a note → a context menu offering its enharmonic alternative spelling (F♯ ↔ G♭) at the same sounding pitch, via `transpose.ts`'s spelling tables (rewrite `<step>`+`<alter>`, octave preserved, natural's `<alter>` removed; minimal `<accidental>` writer when a real pitched note carries one). Builds the **A3** body-portal context-menu primitive (pointer-anchored, keyboard-nav, `data-*` dismiss like `ChordEditor`). **Scoped during M7, then deferred** (2026-06-08). _(Designed, not built.)_

**Why deferred:** Respell is **moot on the chart's placeholder slash notes** (no meaningful pitch to respell); it only pays off once real note pitches are editable ([[P10]]). The A3 context menu was first-needed here, so it defers with respell — section/annotation remove (M7) uses ⌫/× instead. Shares the enharmonic-spelling idea with **P8** (chord respell). The first real home for both is the note-editing epic ([[P10]]).

---

## P13 — Schema-legal carrier for MusiPad-authored annotations

M7 identifies MusiPad-authored free-text annotations by **content, not document position**: each annotation `<direction>` is tagged with a custom `data-musipad="annotation"` attribute (see [`model/directions.ts`](../src/model/directions.ts) — `tagAnnotation`/`isAnnotation`). This lets the readers tell a user annotation apart from the **Feel/style** chip (the first _untagged_ `<words>` in measure 1) and from pre-existing untagged `<words>` (e.g. "D.C. al Coda"), robustly across reload and re-parent.

**The trade-off:** `data-*` is **not** part of the W3C MusicXML XSD — it's a non-schema custom attribute on `<direction>`. OSMD and ordinary consumers ignore unknown attributes (the file renders and round-trips fine), but a **strict schema validator could reject a downloaded file**.

**Scope / ideas — migrate to a schema-legal carrier:**

- an `<other-direction>` with a known/agreed value,
- an XML comment marker adjacent to the direction,
- or another schema-defined hook the readers can key off.

Whichever is chosen, update the `directions.ts` readers (`readChartAnnotations`, `isAnnotation`/`tagAnnotation`) so identification stays **content-based, not position-based**.

**Why deferred:** Annotation identification works today and the file renders / round-trips correctly through OSMD and normal consumers; strict-XSD validation is not part of the MVP's load → edit → play → export loop. Captured so the non-schema attribute is a known, deliberate decision — not an accident. _(Recorded 2026-06-15 at M7 close-out.)_

---

## P14 — Mid-piece / multiple time-signature editing

M8 edits the chart's **single governing meter** — the first `<time>`, like Key relabels the first key (PRD §8 "PoC may limit to the first/active meter… mid-piece `<time>` changes are a further wrinkle"). The [`setMeter`](../src/commands/meter.ts) command patches that one `<time>` and reflows every slash bar to it; the toolbar Meter control reads/writes that one value. This is correct for lead-sheet charts, which carry one meter throughout.

**The wrinkle (flagged by the human during M8):** a song with **more than one** time signature — e.g. a `4/4` verse into a `6/8` bridge, or a single inserted `5/4` bar — has no home in the current model. A second `<time>` would need to be **addressable per region/bar**, and the "set the whole chart's meter" affordance no longer fits.

**Scope / ideas (if ever wanted) — this likely means rebuilding the meter edit, not extending it:**

- Move from a **global toolbar control** to a **per-bar affordance** — the B8.1 "hover/click the staff time signature" idea we set aside for M8 — so each `<time>` is targeted where it sits.
- A command that **inserts / edits / removes a `<time>` at a chosen bar** (add `<attributes><time>` to a measure that has none; remove one to let the prior meter carry forward), reflowing only the bars **governed by that meter region** (from this `<time>` to the next).
- Decide reflow scope per region rather than whole-part; `schedule.ts` already tracks `beats`/`beat-type` as carry-forward state, so playback math is ready — the gap is purely authoring/addressing.
- Pickup/anacrusis bars (`implicit="yes"`, already skipped by `setMeter`) interact with this.

**Why deferred:** Out of the PRD's M8 scope by design (kept M8 to one focused, shippable meter edit). Charts from the pipeline are single-meter, so this has no MVP use; recorded so the single-meter assumption baked into M8 is a known, deliberate boundary — and so whoever revisits it knows it's a **rebuild of the affordance** (global → per-bar), not a small extension. _(Recorded 2026-06-15 during M8.)_

---

## P15 — Compound-meter felt-pulse slash grouping

M9's simplified view (PRD §6.5) draws **N = the time signature's numerator** slashes per bar (4/4 → 4, 6/8 → 6, 7/8 → 7) — the simplest, literal mapping, **chosen for the MVP** (2026-06-15). Compound meters in real charts are usually felt in **dotted-beat pulses**, not raw eighth-note slashes.

**Scope / idea:** group compound meters into felt pulses — 6/8 → 2, 9/8 → 3, 12/8 → 4 — so the slash grid matches how a player counts the bar; simple meters stay numerator-based. Needs a small meter→pulse table, renders the corresponding slash count/positions, and anchors chords to the pulses instead of raw beats.

**Why deferred:** the numerator mapping is correct and readable for the common case (and exactly what the wireframe shows for 4/4); felt-pulse grouping is a musical nicety that adds branching and edge cases. Recorded as the deliberate alternative to the MVP choice. _(Recorded 2026-06-15 during the M9 scoping.)_

---

## P16 — Authoring: create a chart from scratch / add bars

Today MusiPad is a **corrector**: it loads an existing MusicXML and **patches** it (PRD §1, §3 — no note entry/deletion, no structural creation; the empty state is an upload dropzone). The human asked (2026-06-15) how far we are from letting users **(a) add / insert / remove bars** in an existing chart and **(b) start a blank chart from scratch**.

**How far — closer than it looks, and far cheaper than the lead-sheet editor ([[P10]]).** The chord-chart simplification (M9, §6.5) is the key enabler: a chord-chart **bar has no melody to author** — it is just _{meter-derived slash grid + chord symbols + optional section/annotation}_. So "add a bar" does **not** need the hard rhythm/pitch-entry + beat-budget reflow engine that the lead-sheet editor (P10) does. The existing seams already cover most of it:

- **DOM-as-truth + command layer (Invariants #1/#3):** a new `AddMeasure` / `InsertMeasure` / `RemoveMeasure` is just another `Command` (clone a `<measure>` skeleton, renumber, splice) → undo/redo for free.
- **Invariant #2 is trivial for new content:** a brand-new bar (or a blank document) has no load baseline to preserve, so "patch, don't regenerate" isn't stressed — unlike P10's in-bar reflow.
- **Overlay + render clone already handle the rest:** the slash grid is render-clone-derived (M9), so a new bar needs no real notes — chord/section/meter editing, playback, and projection all already work per measure.

**What's needed:**

- **Add bars (existing chart):** `AddMeasure` / `InsertMeasure` / `RemoveMeasure` commands — clone a measure skeleton, set `@number`, handle `<attributes>` inheritance (divisions/time/key live on measure 1; new bars inherit) and the **final barline** moving to the new last bar; a toolbar / inline **＋Bar** affordance. ≈ a small milestone.
- **From scratch (blank chart):** a minimal MusicXML **template** (one part, one measure, default divisions / C major / 4/4, a uniform slash grid) + an empty-state **"Start a blank chart"** entry beside the dropzone (a new `ScoreIO` "new" path, no upload) + light metadata entry (title / key / tempo — M4 already edits these). ≈ add-bars + template + empty-state.

**Risks / decisions:** measure renumbering + `@number` integrity; correct `<attributes>` placement and inheritance; barline / road-map (repeats, P2) interaction when inserting mid-chart; whether `ScoreIO.load` grows a `createBlank()` sibling. Multi-part stays out (single-part assumption, §15).

**Relation to [[P10]]:** explicitly **not** the lead-sheet / melody editor — no note pitch/rhythm authoring. This is **chord-chart-native authoring** (structure + chords only), the natural next capability once M9's slash model lands; P10 remains the separate, heavier melody-editing epic. _(Requested 2026-06-15.)_

---

## P17 — Drag-to-reorder chords (snap to slashes)

Let the user **drag a chord pill** onto another beat to move / reorder it, **snapping to the nearest slash** (beat anchor) — within a bar or across bars — mirroring the section/annotation drag-to-snap (M7). _(Requested 2026-06-15 for an upcoming milestone.)_

**Why it's tractable now — M9 paid for most of it:**

- **Slash anchors already exist.** M9's projector emits one anchor per beat with `{measureIndex, entryIndex, x, y}` ([`overlay/projector.ts`](../src/overlay/projector.ts)), and chord pills already sit on them ([`ChordLayer`](../src/overlay/ChordLayer.tsx)). Snapping = drop onto the nearest anchor's `{measureIndex, entryIndex}`.
- **The drag-to-snap pattern is built.** [`MarkLayer`](../src/overlay/MarkLayer.tsx) already does pointer-down/move/up → highlight the target bar → `onMove(from, to)`; clone it for chord pills (pills are interactive, so a drag threshold must separate drag from the existing click-to-edit).
- **The commands exist.** `setChordAt` / `removeChordAt` ([`commands/chord.ts`](../src/commands/chord.ts)) are measure-scoped and undoable; a `moveChord(fromMeasure, fromEntry, toMeasure, toEntry)` is remove-then-set (or one part-snapshot command), so undo/redo come for free.

**Scope / decisions:**

- Snap target = the nearest beat anchor (slash); an off-beat `<harmony>` `offset` snaps to the nearest beat.
- Dropping on an **occupied** slash: overwrite / swap / no-op — pick one (overwrite is simplest, matching the section upsert).
- Keep it distinct from click-to-edit (drag threshold) and disabled while playing (the chart is display-only then), like the chord editor.

**Promoted to a milestone — M11** (2026-06-15): scheduled as its own chord-editing milestone **after M10** (A4 pages), since it doesn't fit the rendering / pages milestones. Full scope + AC now live in [PRD §9 → M11](./musicxml-editor-prd.md) and [`roadmap.md`](./roadmap.md). **Shipped (M11, 2026-06-16)** — `moveChord` relocates the `<harmony>` element (overwrite-on-occupied, `<part>`-snapshot undo) and `ChordLayer` gained `MarkLayer`-style drag-to-snap with a 4px click/drag threshold. _No longer deferred._

---

## P18 — Auto-pair the recording (naming convention + sidecars)

_Captured 2026-06-16 (2nd-presentation reframe). The deferred half of M13's "Load audio."_

M13 loads the recording by an explicit **Load audio** button (PRD §6.7). The upstream Session Materials Creator writes a fixed naming convention — `<base>_chord_chart.musicxml` ↔ `<base>_stabilised.wav`, plus a `<base>_stabilised.wav.bpm` and `<base>_chord_chart.json` — so the pairing _could_ be automatic.

**Scope / ideas:**

- **Folder open** (File System Access API, `showDirectoryPicker`) or a dual drag-drop that grabs the chart + its matching `_stabilised.wav` by naming convention in one step. Chrome-only; behind a capability check.
- Read the **`.bpm` sidecar** to confirm/seed the audio tempo, and the **`.json`** (key / meter / `sections` with `start_bar`/`end_bar`/`start_time`) to cross-check the chart or pre-seed the alignment offset.
- Validate the pair (same base name; warn on mismatch).

**Why deferred:** a browser can't silently read the sibling WAV; manual load is the simplest robust MVP (PRD §3). Folder access + sidecar parsing is a convenience layered on top, and Chrome-only.

---

## P19 — Audio transport extras: waveform, loop, count-in

_Captured 2026-06-16. Extras beyond M13's play / pause / seek / metronome._

**Scope / ideas:**

- **Waveform** strip under the transport for visual scrubbing and seeing section boundaries against the audio.
- **Loop region** (A–B) to repeat a passage while correcting its chords.
- **Count-in** (one bar of metronome before playback) and an adjustable **metronome volume**.
- Optional **"mute the recording, metronome-only"** toggle (the residual of P3's rehearse mode).

**Why deferred:** the MVP review loop needs only play / pause / seek-by-bar / metronome (PRD §6.7); these are refinements once the core follow-along proves out.

---

## P20 — Audio alignment robustness + optional synth voice

_Captured 2026-06-16. Hardening the M13 sync, and a possible return of synthesized sound._

**Scope / ideas:**

- **Lead-in robustness.** M13 absorbs the WAV's fixed lead-in (the pipeline trims "one bar before beat 1", and `--no-trim-intro` changes it) with a single `audioOffset` + nudge. Harden this: auto-detect the offset from the first downbeat, persist a per-file nudge, handle `--no-trim-intro` exports, and surface a clear "out of sync? nudge here" affordance.
- **Multi-tempo / `--allow-tempo-change` exports.** The pipeline aborts on multi-tempo songs today, so M13 assumes constant tempo. If variable-tempo exports ever ship, the bar↔time map (`schedule.ts` already reads every `<sound tempo>`) must be reconciled with the audio warp.
- **Optional synth voice over the recording.** Re-introduce the retired synth chord realization (M2) as an _optional_ layer — e.g. to audition a corrected chord _against_ the track, or play-along when no recording is loaded. The synth still exists for the metronome + editor audition, so this is a re-wiring, not new audio code. (See **P3**.)

**Why deferred:** the constant-tempo, single-offset case (with a manual nudge) covers the real pipeline output; the rest is hardening for edge exports and an optional enhancement.
