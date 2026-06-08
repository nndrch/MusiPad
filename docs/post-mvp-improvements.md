# Post-MVP improvements

A parking lot for work to pick up **after** the PoC/MVP milestones (PRD §9, M0–M9) are complete. These are deliberately out of scope for the MVP — captured here so they aren't lost. Not prioritized; not committed to a milestone.

---

## P1 — Refine the score's visual design

Make the rendered score feel like a deliberately designed document rather than default OSMD output — consistent with the "notepad, by way of Notion" language (PRD §6.1).

**Scope / ideas:**

- **Custom fonts.**
  - _Music (engraving) font_ — evaluate alternatives to OSMD's default (e.g. Bravura / Petaluma / Leland) and pin one. Petaluma gives a hand-written, lead-sheet feel that may suit a chord-chart tool; Leland is cleaner/modern. Bundle the font + glyph metadata locally (no CDN).
  - _Text font_ — align the score's text elements (title, chord symbols, rehearsal/section marks, annotations) with the app UI font stack (`--font-ui`) so the page reads as one design, not two.
- **Typography fine-tuning.**
  - Chord-symbol size, weight, and vertical position relative to the staff.
  - Section (rehearsal) mark styling — currently a boxed label nudged above the chord row via a fixed offset; revisit once these become HTML overlays (M7) so spacing is consistent across first vs. mid-page systems (see note below).
  - Title / header treatment on the paper (size, spacing, optional removal in favor of the app topbar).
  - Staff size, system spacing, and margins for a calmer rhythm on the page.

**Promoted to a milestone** (no longer deferred): the **Key · Tempo · Feel title subline → M4**. M3 removed OSMD's scattered default marks (the ♩=NN metronome + feel words) because they collided and now live in the topbar chips (`drawMetronomeMarks: false` + `buildRenderDoc` in [`useOsmd.ts`](../src/render/useOsmd.ts)); M4 renders the designed app-display replacement under the title. (Embedding it in the _printed/exported_ document remains part of P4.)

**Notes / context:**

- OSMD exposes most of this via `EngravingRules` and `IOSMDOptions` (font family, `ChordSymbol*`, rehearsal-mark rules, page format/margins) and supports loading custom music fonts.
- Known MVP stopgap: rehearsal-mark vertical offset is a single fixed value (`RehearsalMarkYOffsetDefault`), so the first system reads roomier than mid-page systems. Proper fix lands when sections become draggable HTML overlays we position ourselves (PRD §7.4, M7).

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

**Promoted to a milestone** (no longer deferred):

- the **full-bar playhead highlight → M5** — the entire current measure is highlighted (a soft orange `--accent-tint` wash) during playback instead of the thin-line cursor (which M5 removes), driven by the transport's `currentMeasure` and reusing M5's overlay machinery.
- **auto-scroll to follow the playhead → M5** — when playing, the highlighted bar is scrolled into view (only when it drifts outside a comfortable band, so it doesn't fight the user), working _with_ the zoom-to-fit transform. Originally deferred here for being a quality-of-life refinement; pulled into M5 by the human during the M5 UI-decisions pass since it pairs naturally with the bar-highlight playhead.

**Why deferred:** The MVP proves the headline — hearing the chords realized in the chart's rhythm. Instrument choice and follow-scroll are quality-of-life refinements on top of a working transport, not part of proving the loop.

---

## P4 — A4 PDF generation

True client-side **PDF export in A4 format** — a downloadable, paginated PDF of the rendered chart, beyond what the browser's print dialog produces.

> The simpler **Print** button (browser print via `@media print` CSS, score only) was **promoted to M7** alongside Download. This section now covers only the heavier PDF-generation half.

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

**Why deferred:** The MVP's output of record is the corrected `.musicxml` (M7), and a quick Print covers paper output; a pixel-faithful A4 PDF generator (new deps, pagination) is a heavier convenience layered on top. The paginated re-render above is the shared core for both the PDF generator and a clip-free Print.

---

## P5 — Edits: refinements surfaced by the M4 review

Items flagged by the M4 adversarial review and deliberately deferred — the core edits are correct and reversible (M4 AC holds); these are quality/robustness refinements.

**Scope / ideas:**

- **Disable Key/Tempo/Transpose edits while playing.** Simplest fix for the edit-during-playback behavior: while the transport is playing, disable (grey out) the Key dropdown, Transpose ± and Tempo field so an edit can't yank the schedule out from under playback. (Today an edit reloads the schedule, stopping playback and snapping the playhead to the top — see `useTransport.ts`.)
- **Or: preserve playback position across a schedule rebuild.** The richer alternative to disabling — give `Player` a reload path that keeps `playing`/`positionSec` and re-strikes the held chord at the current position, so a tempo edit takes effect mid-play (fits the **M5** transport/playhead work).
- **Extreme-key enharmonic round-trip.** Transpose is key-aware ([`transpose.ts`](../src/commands/transpose.ts) — it picks the fewest-accidental spelling, so keys stay within ±7 and read conventionally, e.g. A major ↓ = A♭ major). The one residual edge: the two extreme keys at exactly ±6/±7 fifths (F♯/G♭ and C♯/C♭ major) can round-trip (`+n` then `−n`) onto their _enharmonic equivalent_ spelling — musically identical, and these keys are practically absent from lead-sheet charts. A full respell policy (M7) could pin a house spelling here.
- **Preserve non-canonical numeric text.** Transpose canonicalizes `alter` text (a source `"1.0"` becomes `"1"`); key/tempo edits are similar for numeric fields. Harmless for our pipeline (canonical integers only), but a fully byte-faithful patcher would leave untouched numeric formatting intact.
- **Louder missing-data warning.** When a file loads without a key/tempo, M4 shows muted/italic empty-state placeholders ("no key", "no tempo") and the tempo field's "120" placeholder, and playback falls back to 120. A more prominent toast/banner is deferred to **M9** (toasts/empty states) since a coloured warning would break the §6.1 grayscale language used inline.

**Why deferred:** None breaks an M4 acceptance criterion; each is a refinement on top of working, reversible edits.

---

## P6 — Responsive layout for small screens

The score renders at a fixed `NATURAL_WIDTH` and scales proportionally to fit the viewport (zoom-to-fit, no reflow — [`useOsmd.ts`](../src/render/useOsmd.ts)/[`OsmdView.tsx`](../src/render/OsmdView.tsx)), which works well across desktop widths. On **small screens (small tablets / mobile)** the ~4-bars/line layout zooms down so far the chart gets hard to read.

**Scope / ideas:**

- Below a width breakpoint, **break to ~2 bars per line** (vs the default ~4) so each bar is large enough to read on a phone/small tablet. Likely a responsive `RenderXMeasuresPerLineAkaSystem` (4 → 2) driven by a `ResizeObserver`/media query, re-laying-out (not just re-scaling) at that breakpoint — and re-projecting the M5 overlay afterward.
- Consider touch-target sizing for bar selection / future chord targets at that scale.

**Why deferred:** PRD §3 lists **"No mobile-first layout (desktop browser is the target)"** as a PoC non-goal. The zoom-to-fit model already keeps the chart usable when scaled; a true small-screen reading mode is a responsiveness enhancement on top of the working desktop layout. _(Requested 2026-06-07 during the M5 build.)_

---

## P7 — Meter / time-signature editing

**Promoted to a milestone — M8** (M6 3-milestone re-weigh, CLAUDE.md rule 6, 2026-06-08). Scheduled as its own focused milestone after M7 rather than folded in, to keep M7 tight. Full scope + AC now live in [PRD §9 → M8](./musicxml-editor-prd.md) and [`roadmap.md`](./roadmap.md) (hover-edit the staff time signature → undoable `Command` patching `attributes/time`, re-deriving the `schedule.ts` beat math + slash grid). _No longer deferred._

## P8 — Structured chord builder (picker + enharmonic respell)

The shipped M6 chord editor is an **editable combobox** — a text field plus a **dropdown** of the current root's qualities ([`overlay/ChordEditor.tsx`](../src/overlay/ChordEditor.tsx)). It already covers every chord the MVP can express: typing parses `Em7` / `F#m7b5` / `BbMaj7` / `C/E` / `N.C.` / unicode ♯♭Δ°ø–, and the dropdown picks common qualities. _(This was the planned "M6b"; see [`ui-decisions.md`](./ui-decisions.md) decision log, 2026-06-08.)_

**Scope / ideas (if ever wanted):**

- A **structured builder** behind the editor's ▾: a **Root** selector (letter A–G + ♭/♮/♯ accidental), **Quality** buttons grouped by family over the full `kind-value` enum (triads / sixths / sevenths / sus / extended / N.C. — B6.6), and a **collapsible `/ bass`** slash picker (B6.7). Picker clicks compose the working symbol (via the field as the single source of truth) and audition it; Add/Update commits.
- **Enharmonic respell** (B6.5/B6.11): for an accidental root, a one-click `Respell → <twin>` (C♯↔D♭) that flips spelling while keeping quality/bass — backed by a pure `enharmonicAlternatives(step, alter)` helper (reusable for **note respell in M7**, which is where the A3 right-click context menu will first be built).

**Why deferred:** A full working prototype was built and verified (24/24 headless) on `feat/m6b-chord-picker`, then **cut on review as too complex for an MVP** — _"keep it simple as a dropdown with a list of chords"_ (2026-06-08). The dropdown stays the editor. This is recorded so the design (and the `enharmonicAlternatives` approach) isn't lost if a future, non-MVP iteration wants a richer builder.

---

## P9 — Single-note playback / audition

Today only **chords** sound — the harmonic rhythm realized as block voicings ([`schedule.ts`](../src/audio/schedule.ts)). Individual noteheads are **slash placeholders** that only step the visual playhead and are deliberately **never sounded** (PRD §3, §8: "we never play the written placeholder pitch"). This captures two distinct ways to add note-level sound. _(Requested 2026-06-08, after the M6 chord-preview fix.)_

**Scope / ideas:**

- **Click-to-audition a note** _(low-hanging)_ — click/select a notehead → hear that single pitch, mirroring the M6 chord audition. Nearly all the machinery already exists: a note is just a one-element chord, so [`previewChord([midi])`](../src/audio/player.ts) already sounds it; [`computeStaffEntries`](../src/overlay/projector.ts) already emits clickable per-notehead anchors and [`ChordLayer`](../src/overlay/ChordLayer.tsx) mounts hit-zones over them; [`nthSoundingNote`](../src/commands/chord.ts) resolves `(measureIndex, noteIndex) → <note>`; and [`voicing.ts`](../src/audio/voicing.ts) already has the step/octave/alter→MIDI conversion. The **only missing code** is a ~20-line `<note>` → MIDI reader plus one branch in the existing click handler. Estimate: ~half a day + QA. Caveat: a no-op on pure slash/`<unpitched>` placeholders — only meaningful for notes carrying a real `<pitch>`.
- **Transport plays the melody line** _(larger)_ — sound the written note line alongside the chord regions during playback. This **reverses the documented chord-chart reading** (slashes keep time but don't articulate; placeholder pitches are never played), so it needs a **PRD decision** before any code, plus schedule/playback changes to emit and sound per-note pitch events.

**Why deferred:** Beyond the MVP milestone scope (M0–M9) and the chord-chart premise the engine is built on. Captured so the (surprisingly small) audition path and the bigger melody-playback question aren't lost. Surfaced when the chord-preview-cutoff fix was being closed out.

---

## P10 — Evolve into a full lead-sheet editor (melody/note editing)

> **This is an epic / north-star, not a single deferred refinement.** It changes the product's identity — from a **chord-chart corrector** (fix the chords over a fixed slash grid; PRD §3, §8) into a **lead-sheet authoring tool** where the user also writes and edits the **melody** itself. It therefore needs a **product-level decision and its own PRD track** (a milestone series beyond M0–M9), not just a slot in an existing milestone. P9 (note playback) is the first, smallest step on this path; this entry is the whole arc. _(Requested 2026-06-08.)_

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
2. **Pitch editing (in place, no rhythm change)** — change a selected note's pitch: drag up/down a staff step or arrow-key it, with accidental control (♯/♭/♮) and **enharmonic respell** (reuses the `enharmonicAlternatives` helper already slated for M7 / parked in **P8**). Writes `<pitch><step><octave><alter>` via a `Command`. **Local and reversible** — the measure's beat budget is untouched, so this respects Invariant #2 cleanly. Vertical hit-testing (a y on the staff → a diatonic step, given the clef + key) is the main new piece.
3. **Rhythm / duration editing + note entry — _the hard part._** Change a note's duration (`<duration>` ticks + `<type>` + dots), add a note (split a slash/rest into pitched notes), delete a note (→ rest). Unlike chord and pitch edits, **a duration change is non-local**: it shifts every following onset in the bar, and must keep the measure **beat-valid** against its `divisions` + time signature. This needs:
   - a **beat-budget / measure-rebalancing model** (durations must sum to the bar; over/under-full needs a policy — auto-rest fill, push/pull following notes, or reject the edit),
   - **beam and tie recomputation** (`<beam>`, `<tie>`/`<tied>`),
   - a **note-entry interaction** (mouse-on-staff = pitch + insertion point; or keyboard step-time; MIDI input is a later luxury), in the §6.1 "notepad calm" idiom.
   This is what separates a real lead-sheet *editor* from the current figure-level chord editor, and where most of the risk and design effort lives.
4. **Slash ↔ pitched conversion + rests** — a lead sheet routinely mixes a **notated melody** (head/verses) with **slash bars** (solos). The current engine treats every notehead as a slash placeholder; this adds distinguishing real pitched notes from slash notation (`<notehead>slash`, slash `<measure-style>`) and converting between them. Pairs with the **M7 per-bar slash toggle**.
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

**Why deferred:** A deliberate expansion of the product's mission well beyond the PoC/MVP (M0–M9), which proves the chord-chart *correction* loop. Recorded here as the intended evolution path so the architecture decisions made for the MVP (DOM-as-truth, command layer, per-item overlay projection) are understood as the foundation this builds on — and so the hard part (rhythm reflow) is flagged before anyone assumes "it's just chord editing for notes."
