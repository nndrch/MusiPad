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

**Pulled into the PoC** (no longer deferred): reading + showing the **style/feel marking** in the header (next to Key/Tempo), and **~4 bars/line** lead-sheet line breaking (`RenderXMeasuresPerLineAkaSystem`, honoring explicit `<print>` breaks). Both landed in M1.

**Why deferred:** The PoC corrects metadata on existing charts and round-trips the road map untouched; authoring/restyling the navigation is a richer editing surface that builds on M5–M7.

---

## P3 — Playback enhancements

Build on the M2 chord-chart playback engine ([`src/audio/`](../src/audio/)). The PoC sounds chords as a sustained block voicing through a small built-in synth, with the playhead on OSMD's cursor.

**Scope / ideas:**

- **Selectable instrument / synth voice** — let the user pick the playback timbre (piano, acoustic guitar, electric guitar, electric piano, organ, …) instead of the single built-in oscillator tone. The MVP deliberately uses a self-contained Web Audio oscillator synth (zero-dependency, offline, deterministic — see [`synth.ts`](../src/audio/synth.ts)); this swaps in sampled/soundfont instruments behind the same `Synth` interface, with a picker in the transport. (A guitar voice could also motivate strummed/arpeggiated voicings rather than block chords.)
- **Auto-scroll to follow the playhead** — when playing, keep the play marking (cursor) always visible by scrolling the page to track it. The MVP sets OSMD's `follow: false` (the score is a fixed-width scaled page; see [`useOsmd.ts`](../src/render/useOsmd.ts)) so the playhead can run off-screen on long charts. This adds scroll-into-view synced to the cursor, working *with* the zoom-to-fit transform.

**Why deferred:** The MVP proves the headline — hearing the chords realized in the chart's rhythm. Instrument choice and follow-scroll are quality-of-life refinements on top of a working transport, not part of proving the loop.
