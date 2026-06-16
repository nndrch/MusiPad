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

Built in milestones M0 → M12 (see PRD §9; live status in [`docs/roadmap.md`](./docs/roadmap.md)). Shipped so far: **M0–M10**. **Latest — M10 (A4 page layout + view toggle + print):** a topbar **Page / Full** toggle switches the chart between paginated **A4 sheets** (4 bars/row, page breaks between systems only — page 1 carries the title + Key · Tempo header, later pages a page number) and the continuous zoom-to-fit scroll. All editing works in both views. **Print** now reproduces the A4 pages cleanly — multi-page, no mid-system clipping (via a dedicated off-screen A4 render). **Previously — M9 (simplified chord-chart rendering):** the chart renders **minimally** — bars + chord symbols + a per-beat slash grid, with no clef, key glyph, or written melody — and a bar that starts a section opens with a double barline. **Previously — M8 (Meter editing):** hover or click the staff time signature to change it (e.g. 4/4 → 3/4); the slash grid, measure lengths, and metronome re-derive, undoably. **Earlier — M7 (Sections, Annotations, Download + Print)** and **M6 (Chords):** add boxed **Section** pills and free-text **Annotations** to any bar (inline-edit, drag-to-snap, remove — all undoable, persisted as MusicXML `<direction>` marks); edit chords as HTML pills via an editable combobox (type `Em7`/`C/E`/`BbMaj7` or pick a quality), Berklee-normalized and auditioned. **Download** writes a corrected `.musicxml` (declaration/DOCTYPE preserved, unedited bars byte-identical).
