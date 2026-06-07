# Post-MVP improvements

A parking lot for work to pick up **after** the PoC/MVP milestones (PRD §9, M0–M8) are complete. These are deliberately out of scope for the MVP — captured here so they aren't lost. Not prioritized; not committed to a milestone.

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

**Why deferred:** The MVP's output of record is the corrected `.musicxml` (M7), and a quick Print covers paper output; a pixel-faithful A4 PDF generator (new deps, pagination) is a heavier convenience layered on top.

---

## P5 — Edits: refinements surfaced by the M4 review

Items flagged by the M4 adversarial review and deliberately deferred — the core edits are correct and reversible (M4 AC holds); these are quality/robustness refinements.

**Scope / ideas:**

- **Disable Key/Tempo/Transpose edits while playing.** Simplest fix for the edit-during-playback behavior: while the transport is playing, disable (grey out) the Key dropdown, Transpose ± and Tempo field so an edit can't yank the schedule out from under playback. (Today an edit reloads the schedule, stopping playback and snapping the playhead to the top — see `useTransport.ts`.)
- **Or: preserve playback position across a schedule rebuild.** The richer alternative to disabling — give `Player` a reload path that keeps `playing`/`positionSec` and re-strikes the held chord at the current position, so a tempo edit takes effect mid-play (fits the **M5** transport/playhead work).
- **Extreme-key enharmonic round-trip.** Transpose is key-aware ([`transpose.ts`](../src/commands/transpose.ts) — it picks the fewest-accidental spelling, so keys stay within ±7 and read conventionally, e.g. A major ↓ = A♭ major). The one residual edge: the two extreme keys at exactly ±6/±7 fifths (F♯/G♭ and C♯/C♭ major) can round-trip (`+n` then `−n`) onto their _enharmonic equivalent_ spelling — musically identical, and these keys are practically absent from lead-sheet charts. A full respell policy (M7) could pin a house spelling here.
- **Preserve non-canonical numeric text.** Transpose canonicalizes `alter` text (a source `"1.0"` becomes `"1"`); key/tempo edits are similar for numeric fields. Harmless for our pipeline (canonical integers only), but a fully byte-faithful patcher would leave untouched numeric formatting intact.
- **Louder missing-data warning.** When a file loads without a key/tempo, M4 shows muted/italic empty-state placeholders ("no key", "no tempo") and the tempo field's "120" placeholder, and playback falls back to 120. A more prominent toast/banner is deferred to **M8** (toasts/empty states) since a coloured warning would break the §6.1 grayscale language used inline.

**Why deferred:** None breaks an M4 acceptance criterion; each is a refinement on top of working, reversible edits.

---

## P6 — Responsive layout for small screens

The score renders at a fixed `NATURAL_WIDTH` and scales proportionally to fit the viewport (zoom-to-fit, no reflow — [`useOsmd.ts`](../src/render/useOsmd.ts)/[`OsmdView.tsx`](../src/render/OsmdView.tsx)), which works well across desktop widths. On **small screens (small tablets / mobile)** the ~4-bars/line layout zooms down so far the chart gets hard to read.

**Scope / ideas:**

- Below a width breakpoint, **break to ~2 bars per line** (vs the default ~4) so each bar is large enough to read on a phone/small tablet. Likely a responsive `RenderXMeasuresPerLineAkaSystem` (4 → 2) driven by a `ResizeObserver`/media query, re-laying-out (not just re-scaling) at that breakpoint — and re-projecting the M5 overlay afterward.
- Consider touch-target sizing for bar selection / future chord targets at that scale.

**Why deferred:** PRD §3 lists **"No mobile-first layout (desktop browser is the target)"** as a PoC non-goal. The zoom-to-fit model already keeps the chart usable when scaled; a true small-screen reading mode is a responsiveness enhancement on top of the working desktop layout. _(Requested 2026-06-07 during the M5 build.)_
