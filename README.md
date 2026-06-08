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

Built in milestones M0 → M8 (see PRD §9; live status in [`docs/roadmap.md`](./docs/roadmap.md)). Shipped so far: **M0–M5**; **M6 (Chords) in flight** — **M6a built** (PR pending). M6a adds **chord editing**: each chord renders as our own HTML pill above its beat (styled to match the engraving), **click a pill** to edit or remove it, **hover an empty slash** and hit **＋** to add one. The editor is an **editable combobox** — type a symbol (`Em7`, `C/E`, `BbMaj7`…) or pick from the root's qualities; it's normalized to the Berklee house style and auditioned, and every change is undoable. (M6b adds a structured root/quality/bass picker + right-click respell.) Previous — **M5 — Overlay projector + Selection + bar-highlight playhead**: an HTML overlay over the score for **click-to-select a bar** and a full-bar **orange playing highlight** that replaces the old thin-line cursor, **auto-scrolls** the playing bar into view, and lets you **click a bar to seek** while playing.
