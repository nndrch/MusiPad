# Contributing — MusiPad

In-browser MusicXML revision tool. See [`docs/musicxml-editor-prd.md`](./docs/musicxml-editor-prd.md) for full scope, milestones, and acceptance criteria, and [`docs/musicxml-guidelines.md`](./docs/musicxml-guidelines.md) for the MusicXML read/edit cheat-sheet (consult before touching the DOM).

## Core Invariants (PRD §4 — apply to every change)

1. **The model is the MusicXML DOM.** Parse once with `DOMParser`; OSMD is a _view_ re-rendered from the DOM. There is no second source of truth.
2. **Patch, don't regenerate.** Every edit mutates only the specific nodes it touches. Unedited regions must serialize identically to the **normalized-on-load baseline** (a `DOMParser → XMLSerializer` round-trip normalizes the source, so fidelity is measured against that baseline, not the raw bytes; the XML declaration + DOCTYPE are preserved). This protects upstream data (Basic Pitch notes, stems metadata, etc.).
3. **Every edit is a Command.** No component mutates the DOM directly. All mutations go through the command layer (PRD §7) so undo/redo and future features come for free.
4. **Overlays anchor to logical positions, not pixels.** Section marks/annotations store `{measureIndex, beat}`, re-projected to screen coords on every render/resize.
5. **Keep it boring where it can be.** Add structural seams (command layer, load/save adapter) but no speculative features. Simplicity now, extensibility at the seams.

## Build order

Build milestones **M0 → M9** in order (PRD §9). Do not advance past failing acceptance criteria. One PR per milestone.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
