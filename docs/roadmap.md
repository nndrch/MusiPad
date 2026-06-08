# MusiPad — Roadmap & Build Log

A living log of milestones, their PRs/commits, and what's next — so anyone (human or agent) can catch up fast. Build order and acceptance criteria live in the [PRD §9](./musicxml-editor-prd.md); this is the _status_ view.

**How we work** (PRD §0): build **one milestone at a time**; don't start the next until its acceptance criteria pass and the human gives the go-ahead. Before committing a milestone, the human adds any [post-MVP annotations](./post-mvp-improvements.md). One PR per milestone.

---

## Current state (2026-06-08)

- **Shipped:** M0 (Scaffold), M1 (Load + Render), M2 (Playback), M3 (Command layer + Undo/Redo), M4 (Global edits), **M5 (Overlay projector + Selection + bar-highlight playhead)**, and **M6 (Chords — own pills + dropdown chord editor)** are all merged to `main` (M4 [PR #6](https://github.com/nndrch/MusiPad/pull/6) `784cd81`; M5 [PR #7](https://github.com/nndrch/MusiPad/pull/7) `91207eb`; M6 [PR #9](https://github.com/nndrch/MusiPad/pull/9) `ca9160d`).
- **M6 — Chords: complete.** Shipped as the **dropdown** chord editor ([PR #9](https://github.com/nndrch/MusiPad/pull/9)): own HTML pills matching OSMD's engraving + an **editable combobox** (type a symbol or pick from the dropdown of the root's qualities), for add / edit / remove, undoable, with in-editor audition. A structured root/quality/bass **picker + enharmonic respell** (the former "M6b") was prototyped on `2026-06-08` but **dropped as too complex for the MVP**; the idea is parked in [`post-mvp-improvements.md`](./post-mvp-improvements.md) **P8** in case it's ever wanted.
- **Latest merged:** **M6** ([PR #9](https://github.com/nndrch/MusiPad/pull/9)) — own HTML chord pills matching OSMD's engraving + the **dropdown** chord editor (add via hover-＋, edit/remove via the pill, undoable, with in-editor audition).
- **Live preview:** https://musipad.vercel.app (Vercel project `nndrchs-projects/musipad`; GitHub connected → pushes to `main` deploy production, branches/PRs get preview URLs).
- **Planning:** a 3-milestone post-MVP re-weigh (CLAUDE.md rule 6) at M3 promoted three low-hanging items into milestones — **title subline → M4** (shipped), **bar-highlight playhead → M5**, **basic Print → M7**. During M5 scoping the human also pulled **auto-scroll → M5** (was post-MVP P3). A4 PDF generation stays post-MVP. The **M6 re-weigh (2026-06-08)** then promoted **meter / time-signature editing (P7) → new M8** — its own focused milestone after M7, so M7 stays tight — and renumbered **Polish → M9**; everything else stays deferred (P9 note-audition and P10 lead-sheet-editor are product-direction/epic work, not MVP milestones).
- **In flight:** **M7 — Sections, Annotations, Download + Print**. Download + Print shipped on the branch; Sections + Annotations next. The two **note-level** M7 items were **extracted to post-MVP** (2026-06-08): per-bar slash toggle → **P11** (built, on `post-mvp/slash-toggle`), note respell + A3 menu → **P12** — both need note editing (P9/P10) to be worth it, and our chart notes are slash placeholders. Then **M8 — Meter / time-signature editing**, then **M9 — Polish**.
- **Captured requests:** none outstanding — the **meter / time-signature editing** request (2026-06-08) was **promoted to M8** in the M6 re-weigh (see Planning); full scope lives in the M8 milestone (PRD §9) and **P7** is now a promoted stub.

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
| M7  | Sections, Annotations, Download + Print                                 | 🟡 In flight | —                                                     | —                     |
| M8  | Meter / time-signature editing (promoted from P7)                       | ⏳ Planned | —                                                       | —                     |
| M9  | Polish                                                                  | ⏳ Planned | —                                                       | —                     |

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

### M7–M9 ⏳ Planned

- **M7** Draggable sections/annotations + Download (serialize → `.musicxml`, prolog preserved) **+ Print** (`@media print`, score only). Download + Print built; Sections + Annotations next. _(Slash toggle → post-MVP **P11** (built, on `post-mvp/slash-toggle`); note respell + A3 menu → **P12**; both extracted 2026-06-08.)_
- **M8** Meter / time-signature editing — promoted from post-MVP **P7** in the M6 re-weigh (2026-06-08): hover-edit the staff time signature → undoable `Command` patching `attributes/time`, re-deriving the beat math (`schedule.ts` metronome/measure lengths) + slash grid. Its own milestone after M7 (kept out of M7 to avoid bloating it).
- **M9** Polish: toasts, empty/error states, keyboard shortcuts, design audit.

---

## Pointers

- Scope, milestones, acceptance criteria: [`musicxml-editor-prd.md`](./musicxml-editor-prd.md)
- MusicXML read/edit cheat-sheet (this project): [`musicxml-guidelines.md`](./musicxml-guidelines.md)
- Audio→chart generation reference (portable): [`chord-chart-generation-reference.md`](./chord-chart-generation-reference.md)
- Spikes / decisions: [`spikes.md`](./spikes.md)
- Post-MVP backlog: [`post-mvp-improvements.md`](./post-mvp-improvements.md)
- Open UI decisions (scoping worksheet, M5–M9): [`ui-decisions.md`](./ui-decisions.md)
