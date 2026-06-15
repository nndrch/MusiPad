# MusiPad

In-browser **MusicXML revision tool** — load a generated score, correct the high-value metadata (key, tempo, transpose, per-beat chords, sections, annotations, slashes), hear the chords played back (chord-chart realization via Web Audio), and download a corrected `.musicxml`. A calm, Notion-like notepad UI. No backend (PoC).

See [`docs/musicxml-editor-prd.md`](./docs/musicxml-editor-prd.md) for full scope and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the core invariants and build order.

## Stack

Vite + React + TypeScript · [OpenSheetMusicDisplay](https://opensheetmusicdisplay.github.io/) (rendering) · native DOMParser/XMLSerializer (MusicXML read/write) · fflate (`.mxl` unzip) · lucide-react (icons).

## Develop

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build
npm run lint         # ESLint
npm run format       # Prettier
```

## Status

Built in milestones M0 → M12 (see PRD §9; live status in [`docs/roadmap.md`](./docs/roadmap.md)). Shipped so far: **M0–M8**. **Latest — M8 (Meter / time-signature editing):** hover or click the staff time signature to change it (e.g. 4/4 → 3/4); the slash grid, measure lengths, and metronome re-derive to match, and it's undoable. **Next — chord-chart simplification (M9):** the chart is being reframed to render **minimally** (bars + chord symbols + a per-beat slash grid; no clef, key glyph, or written melody), with an **A4 page-layout / print** view and a page-layout ↔ fullscreen toggle (M10). **Previously — M7 (Sections, Annotations, Download + Print):** add **Sections** (boxed rehearsal-mark pills — Intro / Verse / Chorus / … or a custom label) and **Annotations** (free text) to any bar from the toolbar; a new mark lands on the selected bar (else the first bar without one of that kind), is renamed/edited inline, drags to snap onto another bar, and is removed — all undoable. Both persist as standard MusicXML `<direction>` marks, so **Download** writes a corrected `.musicxml` (XML declaration/DOCTYPE preserved, unedited bars byte-identical) and **Print** gives a clean score-only page. **Previously — M6 (Chords):** each chord renders as our own HTML pill above its beat (styled to match the engraving), **click a pill** to edit or remove it, **hover an empty slash** and hit **＋** to add one. The editor is an **editable combobox** — type a symbol (`Em7`, `C/E`, `BbMaj7`…) or pick from a **dropdown** of the root's qualities; it's normalized to the Berklee house style and auditioned, and every change is undoable. (A richer structured picker + respell was considered and deliberately deferred post-MVP to keep the editor simple.)
