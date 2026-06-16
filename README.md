# MusiPad

In-browser **MusicXML revision tool** — the human revision layer over the Session Materials Creator's output (a generated chord chart **+ a beat-stabilised recording**). Load the score, **play the recording in sync** (the current bar highlights and follows, with a metronome guide), correct the high-value metadata (key, tempo, transpose, per-beat chords, sections, annotations, slashes), and **export** a corrected `.musicxml`. A calm, Notion-like notepad UI. No backend (PoC).

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

Built in milestones M0 → M15 (see PRD §9; live status in [`docs/roadmap.md`](./docs/roadmap.md)). Shipped so far: **M0–M12**. **Latest — M12 (Export + retire Print):** the corrected chart is saved with the orange **Export** button (whole-DOM serialize; XML declaration/DOCTYPE preserved, unedited bars byte-identical to the load baseline), and the browser **Print** action was retired from the UI — the tool's output of record is the file, not paper (the page-layout view stays). **Previously — M11 (Drag-to-reorder chords):** drag a chord pill onto another beat — within a bar or across bars — and it snaps to the nearest slash (overwriting any chord already there); a short press still opens the editor, and the move is undoable. **Previously — M10 (A4 page layout + view toggle + print):** a topbar **Page / Full** toggle switches the chart between paginated **A4 sheets** (4 bars/row, page breaks between systems only — page 1 carries the title + Key · Tempo header, later pages a page number) and the continuous zoom-to-fit scroll. All editing works in both views. **Print** now reproduces the A4 pages cleanly — multi-page, no mid-system clipping (via a dedicated off-screen A4 render). **Previously — M9 (simplified chord-chart rendering):** the chart renders **minimally** — bars + chord symbols + a per-beat slash grid, with no clef, key glyph, or written melody — and a bar that starts a section opens with a double barline. **Previously — M8 (Meter editing):** hover or click the staff time signature to change it (e.g. 4/4 → 3/4); the slash grid, measure lengths, and metronome re-derive, undoably. **Earlier — M7 (Sections, Annotations, Download + Print)** and **M6 (Chords):** add boxed **Section** pills and free-text **Annotations** to any bar (inline-edit, drag-to-snap, remove — all undoable, persisted as MusicXML `<direction>` marks); edit chords as HTML pills via an editable combobox (type `Em7`/`C/E`/`BbMaj7` or pick a quality), Berklee-normalized and auditioned. **Download** writes a corrected `.musicxml` (declaration/DOCTYPE preserved, unedited bars byte-identical).

**Next — audio-synced review (M13–M15, 2026-06-16 reframe).** The 2nd-presentation feedback re-anchored MusiPad as the **revision layer** over the Session Materials Creator (a MusicXML chord chart **+ a beat-stabilised recording**). With Export shipped (M12), what's next: **load the paired recording and play it in sync** — the current bar highlights and auto-scrolls to follow, with a **metronome** guide (M13); a **root × quality** double-dropdown chord picker (M14); then a final **Polish** pass (M15). Specs in [PRD §9](./docs/musicxml-editor-prd.md) and [`docs/roadmap.md`](./docs/roadmap.md).
