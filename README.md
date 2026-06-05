# MusiPad

In-browser **MusicXML revision tool** — load a generated score, correct the high-value metadata (key, tempo, transpose, per-beat chords, sections, annotations, slashes), hear it back via MIDI, and download a corrected `.musicxml`. A calm, Notion-like notepad UI. No backend (PoC).

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

Built in milestones M0 → M8 (see PRD §9). Currently: **M1 — Load + Render** complete (load `.xml`/`.musicxml`/`.mxl`, render with OSMD, proportional resize, Key/Tempo header).
