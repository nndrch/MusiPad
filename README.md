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

Built in milestones M0 → M8 (see PRD §9; live status in [`docs/roadmap.md`](./docs/roadmap.md)). Shipped so far: **M0–M4**. Latest — **M4 — Global edits (Key, Transpose, Tempo)**: a toolbar to relabel the key, transpose the whole chart (pitches + key + chords, key-aware spelling), and set the tempo — all undoable. Plus a live document header (title + Key · Tempo subline) and load-time defaults (C major / 120 BPM) with a dismissible alert when a file is missing them.
