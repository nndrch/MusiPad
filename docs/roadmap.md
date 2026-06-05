# MusiPad — Roadmap & Build Log

A living log of milestones, their PRs/commits, and what's next — so anyone (human or agent) can catch up fast. Build order and acceptance criteria live in the [PRD §9](./musicxml-editor-prd.md); this is the _status_ view.

**How we work** (PRD §0): build **one milestone at a time**; don't start the next until its acceptance criteria pass and the human gives the go-ahead. Before committing a milestone, the human adds any [post-MVP annotations](./post-mvp-improvements.md). One PR per milestone.

---

## Current state (2026-06-05)

- **Shipped:** M0 (Scaffold) and M1 (Load + Render) are merged to `main`.
- **Latest:** a docs + small-code pass merged via [PR #2](https://github.com/nndrch/MusiPad/pull/2) — W3C/MusicXML-compliance, chord-playback PRD refactor, Berklee lead-sheet conventions, the header **Feel** chip, **~4 bars/line** rendering, and three new reference docs (guidelines, generation reference, this roadmap).
- **Live preview:** https://musipad.vercel.app (Vercel project `nndrchs-projects/musipad`; GitHub connected → pushes to `main` deploy production, branches/PRs get preview URLs).
- **Next milestone:** **M2 — Playback (chord-chart realization)** — awaiting go-ahead.

---

## Milestone status

| #   | Milestone                                | Status     | PR                                                      | Merge / commit        |
| --- | ---------------------------------------- | ---------- | ------------------------------------------------------- | --------------------- |
| M0  | Scaffold                                 | ✅ Done    | — (direct to `main`)                                    | `2583d81`, `166d61a`  |
| M1  | Load + Render (+ ScoreIO)                | ✅ Done    | [#1](https://github.com/nndrch/MusiPad/pull/1) (merged) | `99fbb78` ← `9dd4d14` |
| —   | W3C-compliance + lead-sheet pass         | ✅ Done    | [#2](https://github.com/nndrch/MusiPad/pull/2) (merged) | see PR #2             |
| M2  | Playback (chord-chart realization)       | ⬜ Next    | —                                                       | —                     |
| M3  | Command layer + Undo/Redo                | ⬜ Planned | —                                                       | —                     |
| M4  | Global edits (Key, Transpose, Tempo)     | ⬜ Planned | —                                                       | —                     |
| M5  | Overlay projector + Selection            | ⬜ Planned | —                                                       | —                     |
| M6  | Chords (dropdown)                        | ⬜ Planned | —                                                       | —                     |
| M7  | Slashes, Sections, Annotations, Download | ⬜ Planned | —                                                       | —                     |
| M8  | Polish                                   | ⬜ Planned | —                                                       | —                     |

Legend: ✅ done · 🟡 in flight · ⬜ not started.

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

### M2 — Playback (chord-chart realization) ⬜ Next

- Build a schedule from note/slash onsets (rhythm) + active `harmony` per onset; sound block chord voicings via Web Audio (don't play placeholder pitches). Transport (play/pause/seek), playhead, metronome toggle, tempo fallback when absent.
- Open question to decide at start: on an onset with no active chord (pre-first-harmony gap), play silence or carry the previous chord?

### M3–M8 ⬜ Planned

- **M3** Command layer + Undo/Redo (the spine; ⌘Z/⌘⇧Z).
- **M4** Global edits: Key (relabel), Transpose (rewrite pitches + key), Tempo (create-when-absent). Round-trip identity test vs load baseline starts here.
- **M5** Overlay projector + bar selection (logical→pixel anchors; ResizeObserver).
- **M6** Chord dropdown (root/quality/bass + enharmonic) writing `harmony` with conventional `kind/@text`.
- **M7** Slashes (per-note notehead), draggable sections/annotations, Download (serialize → `.musicxml`, prolog preserved).
- **M8** Polish: toasts, empty/error states, keyboard shortcuts, design audit.

---

## Pointers

- Scope, milestones, acceptance criteria: [`musicxml-editor-prd.md`](./musicxml-editor-prd.md)
- MusicXML read/edit cheat-sheet (this project): [`musicxml-guidelines.md`](./musicxml-guidelines.md)
- Audio→chart generation reference (portable): [`chord-chart-generation-reference.md`](./chord-chart-generation-reference.md)
- Spikes / decisions: [`spikes.md`](./spikes.md)
- Post-MVP backlog: [`post-mvp-improvements.md`](./post-mvp-improvements.md)
