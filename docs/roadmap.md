# MusiPad — Roadmap & Build Log

A living log of milestones, their PRs/commits, and what's next — so anyone (human or agent) can catch up fast. Build order and acceptance criteria live in the [PRD §9](./musicxml-editor-prd.md); this is the _status_ view.

**How we work** (PRD §0): build **one milestone at a time**; don't start the next until its acceptance criteria pass and the human gives the go-ahead. Before committing a milestone, the human adds any [post-MVP annotations](./post-mvp-improvements.md). One PR per milestone.

---

## Current state (2026-06-16)

- **Shipped (merged to `main`):** **M0 → M11** — Scaffold, Load + Render, Playback, Command layer + Undo/Redo, Global edits, Overlay projector + Selection + bar-highlight playhead, Chords (dropdown), Sections + Annotations + Download + Print, Meter / time-signature editing, **M9 — Simplified chord-chart rendering**, **M10 — A4 page layout + view toggle + print**, and **M11 — Drag-to-reorder chords** (M11 [PR #19](https://github.com/nndrch/MusiPad/pull/19) `84da876`; M10 [PR #18](https://github.com/nndrch/MusiPad/pull/18) `87ff3dd`; M9 [PR #17](https://github.com/nndrch/MusiPad/pull/17) `19518d9`; M8 [PR #16](https://github.com/nndrch/MusiPad/pull/16) `b8418e1`; M7 [PR #15](https://github.com/nndrch/MusiPad/pull/15) `8235d8d`; M6 [PR #9](https://github.com/nndrch/MusiPad/pull/9) `ca9160d`).
- **Next direction — chord-chart simplification + A4 pages (post-M8 feedback, 2026-06-15).** Extended-team feedback reframed the tool as a friendly **chord-chart editor** (later a lead-sheet editor), explicitly **not** a Sibelius/MuseScore competitor. Two new milestones land ahead of the old Polish pass:
  - **M9 — Simplified chord-chart rendering: ✅ shipped** ([PR #17](https://github.com/nndrch/MusiPad/pull/17)). Slashes + chords only; clef/key hidden; section double barlines; real DOM normalized on load; Playback + Download disabled.
  - **M10 — A4 page layout + view toggle + print:** paginated **A4** pages (4 bars/row, breaks between systems) with a **page-layout ↔ fullscreen** toggle; Print reproduces the A4 layout cleanly. Reuses the P4 hidden-second-OSMD `pageFormat:'A4_P'` foundation; downloadable PDF stays in P4. PRD §6.6 / §9 M10.
  - **M11 — Drag-to-reorder chords (snap to slashes):** drag a chord pill onto another beat to move/reorder it, snapping to the nearest slash (promoted from post-MVP P17, 2026-06-15). PRD §9 M11.
  - **M12 — Polish** (renumbered): toasts, empty/error states, keyboard shortcuts, design audit.
- **M6 — Chords: complete.** Shipped as the **dropdown** chord editor ([PR #9](https://github.com/nndrch/MusiPad/pull/9)): own HTML pills matching OSMD's engraving + an **editable combobox** (type a symbol or pick from the dropdown of the root's qualities), for add / edit / remove, undoable, with in-editor audition. A structured root/quality/bass **picker + enharmonic respell** (the former "M6b") was prototyped on `2026-06-08` but **dropped as too complex for the MVP**; the idea is parked in [`post-mvp-improvements.md`](./post-mvp-improvements.md) **P8** in case it's ever wanted.
- **M7 — Sections, Annotations, Download + Print (shipped):** Standard MusicXML `<direction placement="above">` marks: boxed rehearsal-mark **Sections** (`<rehearsal enclosure="square">`) and free-text **Annotations** (`<words>`, tagged `data-musipad="annotation"`), one of each per bar (snap-to-bar); inline edit, drag-to-snap (move), remove, all undoable; rendered as HTML overlays (`MarkLayer`) stripped from the OSMD render clone. Plus the earlier **Download** (serialize → `.musicxml`, prolog preserved) and **Print** (`@media print`, score only). _M7 merged via [PR #15](https://github.com/nndrch/MusiPad/pull/15); latest shipped is now **M9** ([PR #17](https://github.com/nndrch/MusiPad/pull/17))._
- **Live preview:** https://musipad.vercel.app (Vercel project `nndrchs-projects/musipad`; GitHub connected → pushes to `main` deploy production, branches/PRs get preview URLs).
- **Planning:** a 3-milestone post-MVP re-weigh (CLAUDE.md rule 6) at M3 promoted three low-hanging items into milestones — **title subline → M4** (shipped), **bar-highlight playhead → M5**, **basic Print → M7**. During M5 scoping the human also pulled **auto-scroll → M5** (was post-MVP P3). A4 PDF generation stays post-MVP. The **M6 re-weigh (2026-06-08)** then promoted **meter / time-signature editing (P7) → new M8** — its own focused milestone after M7, so M7 stays tight — and renumbered **Polish → M9** (now **M12**, after the chord-chart pivot — see _Next direction_ above); everything else stays deferred (P9 note-audition and P10 lead-sheet-editor are product-direction/epic work, not MVP milestones).
- **In flight:** **M12 — Polish** (PRD §9 M12) is next — the final MVP milestone. **M10** shipped via [PR #18](https://github.com/nndrch/MusiPad/pull/18), **M11** via [PR #19](https://github.com/nndrch/MusiPad/pull/19).
- **Captured requests / new post-MVP (2026-06-15):** the post-M8 feedback added **P15** (compound-meter felt-pulse slash grouping — the alternative to the chosen numerator slashes) and **P16** (authoring — create a chart from scratch / add bars). The earlier meter request was promoted to M8 (now shipped; **P7** is a promoted stub).

---

## Milestone status

| #   | Milestone                                                               | Status     | PR                                                      | Merge / commit        |
| --- | ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------- | --------------------- |
| M0  | Scaffold                                                                | ✅ Done    | — (direct to `main`)                                    | `2583d81`, `166d61a`  |
| M1  | Load + Render (+ ScoreIO)                                               | ✅ Done    | [#1](https://github.com/nndrch/MusiPad/pull/1) (merged) | `99fbb78` ← `9dd4d14` |
| —   | W3C-compliance + lead-sheet pass                                        | ✅ Done    | [#2](https://github.com/nndrch/MusiPad/pull/2) (merged) | see PR #2             |
| M2  | Playback (chord-chart realization)                                      | ✅ Done    | [#4](https://github.com/nndrch/MusiPad/pull/4) (merged) | `315a792`             |
| M3  | Command layer + Undo/Redo                                               | ✅ Done    | [#5](https://github.com/nndrch/MusiPad/pull/5) (merged) | `0df417b`             |
| M4  | Global edits (Key, Transpose, Tempo) + title subline                    | ✅ Done    | [#6](https://github.com/nndrch/MusiPad/pull/6)          | `784cd81`             |
| M5  | Overlay projector + Selection + bar-highlight playhead + auto-scroll    | ✅ Done    | [#7](https://github.com/nndrch/MusiPad/pull/7)          | `91207eb`             |
| M6  | Chords (dropdown) — own pills + dropdown chord editor (add/edit/remove) | ✅ Done    | [#9](https://github.com/nndrch/MusiPad/pull/9)          | `ca9160d`             |
| M7  | Sections, Annotations, Download + Print                                 | ✅ Done    | [#15](https://github.com/nndrch/MusiPad/pull/15)        | `8235d8d`             |
| M8  | Meter / time-signature editing (promoted from P7)                       | ✅ Done    | [#16](https://github.com/nndrch/MusiPad/pull/16)        | `b8418e1`             |
| M9  | Simplified chord-chart rendering (slashes + chords only)                | ✅ Done    | [#17](https://github.com/nndrch/MusiPad/pull/17)        | `19518d9`             |
| M10 | A4 page layout + view toggle + print                                    | ✅ Done    | [#18](https://github.com/nndrch/MusiPad/pull/18)        | `87ff3dd`             |
| M10 | A4 page layout + view toggle + print                                    | ⏳ Planned | —                                                       | —                     |
| M11 | Drag-to-reorder chords (snap to slashes; from P17)                       | ✅ Done    | [#19](https://github.com/nndrch/MusiPad/pull/19)        | `84da876`             |
| M12 | Polish (renumbered from M9)                                             | ⏳ Planned | —                                                       | —                     |

Legend: ✅ done · 🟡 in flight · ⏳ not started.

---

## Log

### M0 — Scaffold ✅

- Vite + React + TS; installed OSMD, lucide-react, fflate, Prettier. Design tokens (§6.1) applied globally; empty-state dropzone.
- Committed **direct to `main`** (no PR, by request): `2583d81 chore: scaffold MusiPad (M0)`; then `166d61a docs: move PRD to docs/ and add metronome toggle spec`.

### M1 — Load + Render (+ ScoreIO) ✅

- **PR [#1](https://github.com/nndrch/MusiPad/pull/1)** (`feat/m1-load-render` → `main`), merged as `99fbb78` (commit `9dd4d14`).
- Delivered: `ScoreIO` adapter + `LocalFileIO` (file load, `.mxl` unzip); `model/xmlDoc` (parse/serialize); OSMD render with **proportional zoom-to-fit** (no reflow); slim topbar.
- Spike S1 resolved ([`spikes.md`](./spikes.md)): OSMD ignores `measure-style/slash` → use per-note `<notehead>slash</notehead>`.
- Review fixes folded in: hide rogue part name / "Music21" composer / duplicate subtitle; lift rehearsal marks above chords.

### W3C-compliance + lead-sheet pass ✅ (PR #2)

Retroactive correctness/quality work on the M0/M1 base, plus PRD reframes. Merged via [PR #2](https://github.com/nndrch/MusiPad/pull/2).

- **MusicXML W3C compliance** (PRD §4/§8/§11): Invariant #2 redefined to a normalized-on-load baseline; `xmlDoc` now preserves the XML declaration + DOCTYPE; `scoreInfo` reads all key modes + non-traditional keys. Added a realistic high-`divisions` sample.
- **Chord-playback PRD refactor:** playback reframed around **chord realization in the chart's rhythm** (block triads/7ths) — the PoC headline, over melodic notes (M2 rewritten; §2/§3/§12/§14/§15 updated).
- **Berklee lead-sheet conventions** folded into PRD/guidelines; added two now-implemented features: header **Feel** chip and **~4 bars/line** rendering.
- **New reference docs:** [`musicxml-guidelines.md`](./musicxml-guidelines.md) (editing this project), [`chord-chart-generation-reference.md`](./chord-chart-generation-reference.md) (portable, for an audio→chart generator), and this roadmap.

### M2 — Playback (chord-chart realization) ✅ (PR #4)

- **PR [#4](https://github.com/nndrch/MusiPad/pull/4)** (`feat/m2-playback` → `main`); feature commit `315a792`.
- Delivered (`src/audio/`): `voicing` (`harmony`→MIDI block voicing, full `kind` enum + slash chords), `schedule` (DOM→tempo-independent timeline + tempo map + metronome beats), `synth` (self-contained Web Audio synth — no soundfont dep — + metronome click), `player` (look-ahead transport on the AudioContext clock, OSMD-cursor playhead), `useTransport`/`Transport` (footer UI). Cursor enabled in `useOsmd`.
- **Key decision:** chord realization follows the **harmonic rhythm** — one chord per `harmony`, sustained until the next change — **not** the per-slash grid (which would sound metronomic). The slashes only step the playhead. (Berklee: rhythm slashes keep time, they don't re-trigger the chord; see [`musicxml-guidelines.md`](./musicxml-guidelines.md), [`chord-chart-generation-reference.md`](./chord-chart-generation-reference.md) §126/§321.)
- **Open question resolved:** pre-first-harmony onsets play **silence**; an active chord carries forward (no mid-piece gap).
- **Flagged (post-MVP, [P3](./post-mvp-improvements.md)):** selectable instrument/synth voice; auto-scroll to keep the playhead visible. **Synth approach:** oscillator synth over `soundfont-player` (zero-dependency, offline, deterministic; swap behind the same `Synth` interface later).
- Verified: `tsc`/`eslint`/`vite build`; 27 deterministic assertions over the fixtures; adversarial multi-agent review (7 findings fixed).

### M3 — Command layer + Undo/Redo ✅ (PR #5)

- **PR [#5](https://github.com/nndrch/MusiPad/pull/5)** (`feat/m3-command-layer` → `main`); feature commit `0df417b`.
- Delivered: `commands/Command` (interface + snapshot-based inverse, PRD §7.3), `commands/History` (undo/redo stacks), `commands/tempo` (`setTempo` demonstrator), `store/useScoreEditor` (React bridge + `revision` re-render seam). Topbar Undo/Redo (disabled-when-empty, platform-aware tooltips) + ⌘Z/⌘⇧Z. Buttons ship inert until M4 supplies an edit trigger.
- **Key decision:** commands mutate the DOM **in place** (Invariant #1); a `revision` counter drives re-render of OSMD/transport/chips. Inverse = subtree snapshot (PRD §7.3), proven byte-identical to the load baseline (Invariant #2) on undo.
- **Also:** dropped the redundant ♩=NN tempo mark (`drawMetronomeMarks`) + feel words from the page (view-only `buildRenderDoc` clone) — they collided and live in the topbar chips; the real DOM is untouched.
- **Planning (CLAUDE.md rule 6, 3-milestone re-weigh):** promoted **title subline → M4**, **bar-highlight playhead → M5**, **basic Print → M7** (PRD §9 updated; A4 PDF generation stays post-MVP).
- Verified: `tsc`/`eslint`/`vite build`; 26 deterministic command assertions; adversarial multi-agent review (2 findings handled).

### M4 — Global edits (Key, Transpose, Tempo) ✅ (PR #6)

- **PR [#6](https://github.com/nndrch/MusiPad/pull/6)** (`feat/m4-global-edits` → `main`); feature commit `784cd81`.
- Delivered: `commands/key` (relabel `fifths`/`mode`, siblings preserved), `commands/transpose` (key-aware — moves pitches **+ key + chord root/bass**; picks the fewest-accidental spelling so `fifths` stays within OSMD's ±7 and reads conventionally; reversible `±n`/`∓n`), `commands/tempo` (completes the `sound`↔`metronome` partial-sync), `model/defaults` (load-time C major / 120 BPM + dismissible `ui/Banner`), `ui/Toolbar` (Key ▾ / Transpose ± / Tempo), `render/ScoreHeader` (HTML title + Key·Tempo subline on an A4-proportioned sheet; OSMD title off). Undo/Redo go live.
- **Key decisions:** transpose moves the chord symbols too (a chord chart's visible/audible content) and is **key-aware** to dodge OSMD's `fifths`>±7 crash and remote spellings; missing key/tempo are **defaulted on load** with a dismissible alert; the redundant topbar Key/Tempo/Feel chips were removed and **feel deferred to post-MVP** (the `scoreInfo` reader stays).
- Round-trip identity test vs the load baseline starts here (transpose `+n`/`−n`).
- Verified: `tsc`/`eslint`/`vite build`; **63** deterministic command assertions; adversarial multi-agent review (5 findings handled — incl. the transpose ±7 overflow crash and the tempo `<direction>` child-order).

### M5 — Overlay projector + Selection + bar-highlight playhead + auto-scroll ✅ (PR #7)

- **PR [#7](https://github.com/nndrch/MusiPad/pull/7)** (`feat/m5-overlay-projector` → `main`); feature commit `91207eb`. UI decisions settled first ([`ui-decisions.md`](./ui-decisions.md) A2/B5.\*): **selection = warm-gray border + light fill** (MuseScore-style), **playing = orange** wash — distinguished by _hue_ so they never collide; **no idle bar hover** (the hover cue is reserved for individual items in M6/M7); Esc / desk-click deselect; **click-a-bar-to-seek while playing** (light-orange playing-mode hover); auto-scroll pulled into M5; beat anchors are invisible scaffolding (rendered from M6). Edit-mode bar hover is **disabled** (commented off; editing is figure-level). Item-level interactions — figure hover→accent, in-bar item highlight, and the **chord add/edit popover** (select slash → ＋ add; click chord → edit/Update) with in-editor **chord audition** — were specced from the human's mockups but deferred to **M6/M7** (need per-item projection — B6/B7).
- Delivered: `overlay/projector` (measure boxes from `osmd.GraphicSheet.MeasureList`; **self-calibrated** px-per-unit from the rendered SVG width vs the page's unit width — no reliance on OSMD's un-typed `UnitInPixels`; vertical band per `ParentMusicSystem` to cover the chord row), `overlay/useMeasureBoxes` (re-projects on each render; derives the overlay frame from the **host** element + its padding since svg elements lack `offsetLeft`), `overlay/OverlayLayer` (mounted inside `.osmd-scale` so it rides the zoom-to-fit transform; click-to-select, hover, playing highlight, auto-scroll). Schedule gains `measureStartQuarters`; `Player` computes `TransportState.currentMeasure` off the audio clock. Selection is **ephemeral view state in `App`/`Score`**, not a Command (Invariant #3 governs DOM mutations only).
- **Key decisions:** the M2 OSMD cursor is fully disabled — removing `cursorsOptions` still left OSMD's _default_ cursor (a stray green box), so the `CursorController` adapter is now a no-op; the full-bar highlight is the sole playhead (B5.5). Overlay coords are computed once per render in unscaled space; resize is handled by the shared CSS transform (no per-resize recompute), still Invariant-#4 compliant.
- Verified: `eslint`/`tsc`/`vite build`; headless-Chromium live pass (10/10) — box alignment within the SVG, one box per measure, single-select, Esc + desk-click deselect, **overlay re-projects after a transpose edit**, playing highlight advances (m0→m1→…), no visible OSMD cursor, auto-scroll on a constrained viewport.

### M6 — Chords ✅ (shipped as the dropdown editor)

M6 was planned as **two PRs** (2026-06-07, see [`ui-decisions.md`](./ui-decisions.md) B6) but shipped as **one** — M6a (PR #9) met the AC, and the planned **M6b structured picker + respell was dropped as too complex for the MVP** (2026-06-08; see the close-out note below). UI decisions were locked first.

**M6a — own pills + dropdown editor ([PR #9](https://github.com/nndrch/MusiPad/pull/9), `ca9160d`):**

- Delivered:
  - `model/chordSymbol` — pure chord core: `parseChordSymbol` (typed text → spec, accepts `Em7`/`F#m7b5`/`BbMaj7`/`C/E`/`N.C.`/unicode ♯♭Δ°ø–), `formatChordSymbol` + `qualityLabel` (Berklee house style), `readChordSpec`/`readChartChords` (DOM → specs located by `{measureIndex, entryIndex}`).
  - `commands/chord` — `setChordAt` / `removeChordAt`, **measure-scoped** so the existing `editElement` subtree-snapshot inverse covers insert / rewrite / remove uniformly (undoable, Invariant #2/#3). Writes `<harmony>` in schema child order (`root → kind → bass`), preserving `inversion`/`degree`/`frame`/`offset`/`@type`.
  - `overlay/projector.computeStaffEntries` — accurate per-note anchors from OSMD's graphical staff entries (replaces M5's linear beat-anchor scaffold, as B5.7 anticipated); `useMeasureBoxes` now returns `entries`.
  - `overlay/ChordLayer` (own HTML pills; empty-slash hover zones that reveal a ＋) + `overlay/ChordEditor` (the A1 popover — an **editable combobox**: wide field + dropdown of the root's qualities with the current one checked, ▷ Hear, Add/Update, Remove) + CSS.
  - Audition: `audio/voicing.voicingFromSpec` + `Player.previewChord` (exposed via `useTransport`); applying a chord (or picking a list option) auto-auditions.
- **Key decisions:** **own HTML pills** (B6.1), **styled to match OSMD's engraving exactly** (Times New Roman / normal / ~20px / chart ink) and sitting in OSMD's reserved chord row — OSMD's glyphs painted transparent (`DefaultColorChordSymbol = '#00000000'`) with `RenderChordSymbols` kept **on** so **layout/rehearsal-mark spacing don't shift** vs M5; pills anchored by **graphical staff-entry x** so they sit exactly over the slash. Editing is **figure-level and kept separate from note-editing**: **hover an empty slash → ＋ → add**; **hover a chord → highlight, click → edit/remove**. Display normalizes to **Berklee** (B6.8) but only an explicit edit rewrites `kind/@text` (untouched chords export verbatim).
- **AC (PRD §9 M6):** ✅ add a per-beat chord; ✅ edit & remove; ✅ all undoable; persists in the DOM for download (M7).
- Verified: `eslint`/`tsc`/`vite build`; headless-Chromium live pass (28/28) — pills render Berklee-normalized & matching OSMD's font/row, glyphs suppressed, pill clears the rehearsal mark, empty-slash hover reveals ＋, chord hover highlights, combobox add (type) + pick-from-list, edit pre-fills, remove, undo/redo, hover zones hidden while playing, no page errors.

**M6b — structured picker + respell: DROPPED (2026-06-08).** The planned root/quality/bass button picker + enharmonic letter+accidental selector + collapsible bass + in-editor respell was prototyped and verified (24/24 headless) on `feat/m6b-chord-picker`, but on review the human judged it **too complex for an MVP** — "keep it simple as a dropdown with a list of chords." The work was **discarded uncommitted** (never merged) and the branch deleted; the editor stays the M6a dropdown. The idea is parked in [`post-mvp-improvements.md`](./post-mvp-improvements.md) **P8** if it's ever wanted. Consequence: A3's right-click context-menu primitive is now first needed in **M7** (note respell, B7.4).

### M7 — Sections, Annotations, Download + Print ✅

- **Scope (final):** Download + Print (shipped earlier in M7, `d30ffe8`) **+ Sections + Annotations** ([PR #15](https://github.com/nndrch/MusiPad/pull/15)). The two **note-level** items were de-scoped to post-MVP — slash toggle → **P11** (built, on `post-mvp/slash-toggle`), note respell + A3 menu → **P12** (both 2026-06-08).
- **Download + Print:** Download serializes the live DOM → `.musicxml` (XML prolog/DOCTYPE preserved, Invariant #2); Print uses `@media print` to emit the score only.
- **Sections + Annotations:** two chart-authoring marks, both **standard MusicXML** `<direction placement="above">` in the part — **Section** = boxed rehearsal mark (`<direction-type><rehearsal enclosure="square">LABEL</rehearsal>`), **Annotation** = free text (`<direction-type><words>TEXT</words>`, the `<direction>` tagged `data-musipad="annotation"` so MusiPad notes are identified by content, not document position — protecting the Feel chip, the first untagged `<words>` in measure 1). One section + one annotation max per measure, keyed by `measureIndex` (snap-to-bar).
- **Authoring:** toolbar group — `＋Section` preset dropdown (Intro / Verse / Chorus / Bridge / Solo / Outro / Custom…) and `＋Note` button. Target = the selected bar, else the first bar with no mark of that kind (auto first-empty, so a toolbar add never overwrites); no-op if all bars occupied and nothing selected.
- **Edit / move / remove:** inline edit (click → input, Enter commit / Esc cancel / blur commit); drag a pill/text to snap it to another bar (move command, whole-part snapshot undo); remove via Backspace (selected) or ×. All operations undoable.
- **Rendering:** marks are HTML overlays drawn by a single generic [`overlay/MarkLayer.tsx`](../src/overlay/MarkLayer.tsx) (mounted twice — `variant="section"` and `variant="annotation"`), stripped from the OSMD render clone (`buildRenderDoc`) so OSMD doesn't double-draw them. Marks stack above the chord row (annotation in the base row, section one row up when both are present). OSMD `EngravingRules` opened up (`MinimumDistanceBetweenSystems`, `MinSkyBottomDistBetweenSystems`, `PageTopMargin`, `ChordSymbolYPadding`) so marks clear the staff.
- **New files:** [`model/directions.ts`](../src/model/directions.ts) (`feelWordsDirection`, `readChartSections`, `readChartAnnotations`, `firstFreeMeasure`, `tagAnnotation`/`isAnnotation`), [`commands/section.ts`](../src/commands/section.ts), [`commands/annotation.ts`](../src/commands/annotation.ts), `overlay/MarkLayer.tsx` + `.css`. **Modified:** `App.tsx`, `render/OsmdView.tsx`, `render/useOsmd.ts`, `model/scoreInfo.ts`, `ui/Toolbar.tsx` + `.css`.
- **AC (PRD §9 M7):** ✅ add section + annotation, drag to another bar, all undoable; ✅ download → reopening shows all edits, unedited measures byte-identical to load baseline, declaration/DOCTYPE intact; ✅ Print = clean score-only page.
- **Recorded trade-off ([P13](./post-mvp-improvements.md)):** `data-musipad="annotation"` is a non-schema custom attribute on `<direction>` — the W3C MusicXML XSD doesn't define `data-*`, so a strict schema validator could reject a downloaded file. Accepted for robust, position-independent annotation identification; a schema-legal carrier is parked in P13.

### M8 — Meter / time-signature editing ✅ ([PR #16](https://github.com/nndrch/MusiPad/pull/16))

- Promoted from post-MVP **P7** (M6 re-weigh, 2026-06-08). Hover/click-edit the staff time signature → undoable `setMeter` ([`commands/meter.ts`](../src/commands/meter.ts)) patching `attributes/time` (`beats`/`beat-type`, siblings preserved), re-deriving the beat math (`schedule.ts` metronome grid + measure lengths) and reflowing slash bars to the new meter. Toolbar Meter control reads/writes the **single governing meter** (first `<time>`, like Key); mid-piece / multiple `<time>` changes parked in **P14**.

### M9 — Simplified chord-chart rendering ✅ ([PR #17](https://github.com/nndrch/MusiPad/pull/17))

From the post-M8 extended-team feedback (2026-06-15): reframe MusiPad as a friendly **chord-chart editor** (not a notation suite) and render minimally.

- Delivered: clef and key-signature glyphs hidden via `EngravingRules`; noteheads/stems painted transparent so melody disappears visually while the DOM is preserved. Every bar **normalized to the per-beat slash grid on load** (`force:true` in `handleFile`) so the editable DOM matches the display and chord-add works on any beat. Own `SlashLayer` SVG overlay (diagonal strokes, geometry from VexFlow stave). Section-start **double barline** persisted as `light-light` left barline (`barline.ts` helpers), wired into add/remove/move section, and normalized on load for pre-existing sections (`normalizeSectionBarlines`). `MarkLayer` divider anchored to `staffTopY`/`staffBottomY`. Download and Playback UI disabled (`ENABLE_DOWNLOAD` / `ENABLE_PLAYBACK` flags).
- Verified: `eslint`/`tsc`/`vite build` clean; PRD §9 M9 AC met.

### M10 — A4 page layout + view toggle + print ✅ ([PR #18](https://github.com/nndrch/MusiPad/pull/18))

Adds the §6.6 page-layout view and the **Page ↔ Full** toggle (default **Page**), and replaces the M7 single-SVG print with a clean paginated A4 print.

- **Screen — one OSMD instance, page format toggled by `viewMode`** (`Endless` for Full, `A4_P` for Page). Page mode stacks A4 sheets in the existing `.osmd-scale` zoom-to-fit column. The overlay projector ([`overlay/projector.ts`](../src/overlay/projector.ts)) became **page-aware**: it maps each measure to its page (via `ParentMusicSystem.Parent`) and adds the page's top offset — read live from each OSMD page-wrapper's `offsetTop` — so the single overlay layer spans the column and every pill/slash/mark/selection lands on the right sheet. Coordinates reset per page (OSMD renders one `<svg>` per page), so this offset is the whole trick; one funnel (`useMeasureBoxes`) means the 5 overlay components were untouched. Continuous mode = one page = offset 0 = byte-for-byte the old behaviour.
- **Page chrome:** the title + Key·Tempo header is drawn on sheet 1; later sheets get a page number — both absolutely positioned in the sheet margins (`OsmdView`, from `computePageRects`). Sheets are styled as white paper on a faint desk with an inter-sheet gap.
- **Print — a dedicated off-screen A4 render** ([`render/PrintView.tsx`](../src/render/PrintView.tsx), the post-mvp **P4** recipe): a hidden OSMD at `A4_P` inks the chords/slashes/sections itself (no HTML overlay to break across pages), each page `<svg>` captured into its own `.print-sheet` (`break-after: page`). `Print` runs `await printView.prepare()` then `window.print()`; [`print.css`](../src/print.css) hides the live app and reveals the pre-paginated sheets. Closes the M7 mid-system-clipping limitation.
- **AC (PRD §9 M10):** ✅ toggle switches Page ↔ Full; a multi-system chart paginates onto multiple A4 sheets, breaks between systems (no clipped bars); 4 bars/row; page 1 header / later pages page number; Print outputs the clean paginated A4; all edits work in page mode; unedited bars identical to the load baseline (the real DOM is untouched by either view).
- **Verified:** `eslint`/`tsc -b`/`vite build` clean; headless-Chrome live pass on a new 64-bar sample ([`public/samples/leadsheet.musicxml`](../public/samples/leadsheet.musicxml)) — 3 A4 pages, overlays distributed 128/112/16 across pages, chord editor opens on page 2, header + page numbers placed, Full mode unregressed, Print → 3-page A4 PDF with no clipping.
- **Deferred (post-MVP):** A4 **PDF download** stays P4; **exact Berklee chord parity on print** — OSMD ignores `<kind text>`, so print shows its house style (`Dm7`/`Cmaj7`) vs the screen pills (`Dmi7`/`CMaj7`); fixable later via OSMD's `setChordSymbolLabelText` (noted in P4). Print slashes are OSMD's slash-noteheads (with stems) rather than the screen's minimal strokes.

### M11 — Drag-to-reorder chords (snap to slashes) ✅ ([PR #19](https://github.com/nndrch/MusiPad/pull/19))

Lets a chord pill be **dragged onto another beat** — within a bar or across bars — snapping to the nearest slash, mirroring the M7 section/annotation drag-to-snap. Promoted from post-MVP **P17**.

- **`moveChord(fromMeasure, fromEntry, toMeasure, toEntry)`** ([`commands/chord.ts`](../src/commands/chord.ts)) — **relocates the whole `<harmony>` element** (so its `kind/@text`, `inversion`, `degree`, `frame`, `@type` ride along, Invariant #2), drops a stale beat `<offset>` (snaps onto the target beat), and **overwrites** any chord already there. Snapshots the `<part>` for the inverse since a move can touch two measures (like `MoveSection`); undoable.
- **`ChordLayer` drag** — clones `MarkLayer`'s pointer-capture flow on the pills: `pointerdown` captures, `pointermove` past a 4px threshold becomes a drag (else it's still a click → opens the editor), the nearest beat **anchor under the pointer** is the snap target (highlighted with a dashed `.chord-drop` box), `pointerup` dispatches `moveChord` when the target differs. The dragged pill follows the pointer (keeping its −50% centering); screen↔unscaled uses the layer's live rect-vs-frame scale, so it's correct in **both** view modes (page + full).
- Wired `onMoveChord` through `OsmdView` → `App` (`handleMoveChord` → `dispatch(moveChord(...))`).
- **AC (PRD §9 M11):** ✅ drag a chord to another slash (same bar and across bars) → it moves and snaps; the `<harmony>` moves with it (persists in the DOM/download); click-to-edit still works (drag threshold); undo/redo reverts the move.
- **Verified:** `eslint`/`tsc -b`/`vite build` clean; headless-Chrome drag pass on the A4 page-layout sample — within-bar move, across-bar move with overwrite, undo reverts, click-to-edit preserved, drop-target highlight + dragging-pill affordances render.

### M12 ⏳ Planned — Polish

- **M12 — Polish:** toasts, empty/error states, keyboard shortcuts, design audit (renumbered from the old M9).

---

## Pointers

- Scope, milestones, acceptance criteria: [`musicxml-editor-prd.md`](./musicxml-editor-prd.md)
- MusicXML read/edit cheat-sheet (this project): [`musicxml-guidelines.md`](./musicxml-guidelines.md)
- Audio→chart generation reference (portable): [`chord-chart-generation-reference.md`](./chord-chart-generation-reference.md)
- Spikes / decisions: [`spikes.md`](./spikes.md)
- Post-MVP backlog: [`post-mvp-improvements.md`](./post-mvp-improvements.md)
- Open UI decisions (scoping worksheet, M5–M9): [`ui-decisions.md`](./ui-decisions.md)
