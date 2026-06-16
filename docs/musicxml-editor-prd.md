# PRD & Build Guide — In-Browser MusicXML Revision Tool (PoC)

> **Audience:** Claude Code (and the human driving it).
> **Status:** PoC scope, locked. Designed to grow into a fuller note-taking/notation tool later.
> **How to use this doc:** Build in the numbered **Milestones** order (§9). Each milestone has acceptance criteria — do not advance until they pass. Honor the **Core Invariants** (§4) on every change.

---

## 0. Global Project Instructions (always apply)

These override default behavior and apply to **every** milestone and change.

1. **Build one milestone at a time.** Work only the current milestone (PRD §9); do not start the next one until its acceptance criteria pass and the human gives the go-ahead.
2. **Before committing, ask the human to write post-MVP improvement annotations.** When a milestone is complete and ready to commit, pause and prompt the human to capture any ideas/refinements for later in [`post-mvp-improvements.md`](./post-mvp-improvements.md). Only commit after they've had that chance.

---

## 1. Context & Problem

An upstream "audio-to-preproduction" pipeline (Demucs, Basic Pitch, MSAF, madmom, key/tempo estimation) turns audio into a MusicXML score. The output is a good start but **inaccurate** — wrong chords, mislabeled sections, off key/tempo. There is currently no way for a human to correct it without leaving for desktop software.

This tool is a **browser-based correction layer** for **chord charts**: load the generated MusicXML, fix the high-value metadata (chords, sections, key, tempo, slashes), **hear the chords play back** in the chart's rhythm, and export a corrected MusicXML. It is **not** a blank-canvas notation editor and does **not** need publishing-grade engraving.

**Positioning (2026-06-15).** MusiPad is a friendly, **user-friendly chord-chart editor** — and, later, a lead-sheet editor — explicitly **not** a competitor to full notation suites like **Sibelius or MuseScore**. To set that expectation in the product itself, the chart renders **minimally**: only **bars, chord symbols, and a per-beat slash grid** — no clef, no key-signature glyph, no written melody (see §6.5). The simpler the surface, the clearer the promise.

## 2. Goals

- Load a MusicXML (`.xml` / `.musicxml` / `.mxl`) in the browser and render it as a **minimal chord chart** — bars, chord symbols, and a per-beat slash grid (§6.5).
- Correct: **key signature**, **transpose**, **enharmonic spelling** (per chord/note), **tempo/BPM**, **per-beat chord symbols** (dropdown UI), **per-bar rhythm slashes**, **draggable section marks and annotations**.
- **In-browser chord-chart playback:** this tool is primarily for editing and **playing chord charts**, so playback realizes the **chord symbols** (audible harmony) in the chart's rhythm — the headline audio feature, more central than melodic note playback. It reflects edits (tempo, transpose, chord changes).
- **Undo/redo** for every edit.
- Export the corrected MusicXML as a download.
- **Page layout & print:** view the chart as paginated **A4** pages — with a **page-layout ↔ fullscreen** toggle — for clean, print-friendly output (§6.6).
- A calm, minimal, **Notion-like "notepad"** UI.

## 3. Non-Goals (PoC)

- No backend, no auth, no persistence beyond download. (Designed for easy backend swap later — see §10.)
- No note **entry**/deletion, no beaming/voicing/lyrics editing, no engraving controls.
- No playback of the **written placeholder pitches**. On a chord chart the notes are slash/rhythm markers (e.g. a repeated `B4`), so we sound the **active chord** at each onset instead, not the written pitch. (Melodic playback of real note pitches is out of scope for the PoC.)
- **No melody / standard notation.** The chart shows only **bars, chord symbols, and a per-beat slash grid** (§6.5). On load, every bar is **normalized to that slash grid** — the source note content is replaced by slashes (a chord chart has no melody; no clef, key-signature glyph, beamed rhythms, or noteheads ever appear). A deliberate simplification (§1 positioning), not a missing feature.
- No `.mxl` _writing_ (read `.mxl` is fine via unzip; write plain `.musicxml`).
- No mobile-first layout (desktop browser is the target).

## 4. Core Invariants (apply to every change)

1. **The model is the MusicXML DOM.** Parse once with `DOMParser`; OSMD is a _view_ re-rendered from the DOM. There is no second source of truth.
2. **Patch, don't regenerate.** Every edit mutates only the specific nodes it touches; never reconstruct an element from scratch (that drops optional children/attributes the spec allows — `frame`, `inversion`, `degree`, positioning, `print-object`, `type`, `footnote`/`level`, etc.). **Round-trip baseline:** a `DOMParser → XMLSerializer` cycle is _not_ byte-identical to the source (it normalizes self-closing tags, attribute quoting, whitespace, entity escaping). So the invariant is measured against a **normalized-on-load baseline**, not the raw input bytes: serialize the pristine DOM once at load; an unedited region must serialize identically to _that baseline_. Preserve the original XML declaration and DOCTYPE verbatim through the round-trip (XMLSerializer emits neither). This protects upstream data (Basic Pitch notes, stems metadata, etc.).
3. **Every edit is a Command.** No component mutates the DOM directly. All mutations go through the command layer (§7) so undo/redo and future features come for free.
4. **Overlays anchor to logical positions, not pixels.** Section marks/annotations snap to a whole bar — keyed by `measureIndex` (one section + one annotation max per measure) — while chords anchor to a beat (`{measureIndex, entryIndex}`); all are re-projected to screen coords on every render/resize.
5. **Keep it boring where it can be.** Add structural seams (command layer, load/save adapter) but no speculative features. Simplicity now, extensibility at the seams.

---

## 5. User Flow (PoC)

```
Upload MusicXML  →  Preview (render)  →  Edit  →  Play (chords)  →  Download corrected MusicXML
```

- **Upload:** drag-drop or file picker. Accept `.xml`, `.musicxml`, `.mxl`. (`.mxl` = zip; unzip to the root `.xml`.)
- **Preview:** OSMD renders the score on a paper-like canvas.
- **Edit:** toolbar + inline controls + draggable overlays (details §6, §8).
- **Play:** transport bar; in-browser **chord-chart playback** — the active chord sounds at each onset in the chart's rhythm (Web Audio soundfont), with a metronome toggle.
- **Download:** serialize DOM → `.musicxml` file download.

---

## 6. UI / UX Spec

### 6.1 Design language — "notepad, by way of Notion"

Calm, content-first, almost chrome-less. The score is the document; controls are quiet and get out of the way. Grayscale base, **one** orange accent used sparingly (selection, active state, primary action only).

**Design tokens (CSS variables):**

```css
:root {
  /* surfaces */
  --bg: #ffffff; /* the "paper" */
  --surface: #f7f7f5; /* toolbars, panels (Notion off-white) */
  --surface-hover: #efefed;
  --border: #e9e9e7;
  --border-strong: #dcdcda;

  /* ink */
  --text: #37352f; /* primary */
  --text-muted: #787774; /* secondary/labels */
  --text-faint: #9b9a97; /* hints, placeholders */

  /* accent (orange) — used sparingly */
  --accent: #e8590c;
  --accent-hover: #d9480f;
  --accent-tint: #fff4ed; /* selected-row / active background */
  --accent-ring: rgba(232, 89, 12, 0.3);

  /* shape */
  --radius: 6px;
  --radius-sm: 4px;
  --shadow-pop: 0 4px 14px rgba(15, 15, 15, 0.1); /* dropdowns/popovers only */

  /* type */
  --font-ui:
    ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}
```

**Rules:**

- Generous whitespace; max content width ~960px centered, like a Notion page.
- Borders over shadows. Shadows only on popovers/dropdowns.
- Accent **only** for: active/selected element, primary button, playback position. Everything else is grayscale.
- Hover = subtle bg shift (`--surface-hover`), never a loud color.
- Icons: thin line icons (lucide-react). Small, muted, gain accent only when active.
- No gradients, no heavy fills, no rounded "card" overload. Flat and quiet.

### 6.2 Layout

```
┌───────────────────────────────────────────────────────────┐
│  Topbar: [file name]  Key·Tempo·Feel  [Undo][Redo] [Download]│  ← slim, --surface
├───────────────────────────────────────────────────────────┤
│  Toolbar (inline, quiet): Key ▾  Transpose ±  Tempo [120]  │  ← only global controls
│                            ＋Section  ＋Note  Slashes:bar    │
├───────────────────────────────────────────────────────────┤
│                                                             │
│                    ░░  SCORE (OSMD)  ░░                      │  ← --bg "paper", centered
│            (overlay layer for chords / sections / notes)    │
│                                                             │
├───────────────────────────────────────────────────────────┤
│  Transport:  ▶ / ⏸   ●────────  00:12 / 02:30   ⏱ Metronome │  ← playhead in --accent
└───────────────────────────────────────────────────────────┘
```

- **Empty state:** centered dropzone, faint dashed border, "Drop a MusicXML file or click to choose." Notepad-blank.
- **Download** is the only orange (primary) button in the topbar.
- **Transport (footer):** play/pause, seek bar with playhead (in `--accent`), elapsed / total time, and a **Metronome toggle**. The metronome is a quiet line-icon toggle (`⏱` lucide), grayscale when off, gaining `--accent` when on. When **on**, it emits an audible click on every beat, in time with the song's current tempo (BPM); it follows tempo edits live and re-syncs on play/pause/seek. When **off**, no click is emitted. (Default: off.)
- **View toggle (M10):** a quiet topbar control switches the chart between **Page layout (A4)** and **Fullscreen (continuous)** (§6.6); **Print** (M7) and **Download** sit alongside it.

### 6.3 Editing interactions

- **Chords — dropdown UI.** Click a beat anchor (small ghost target above the staff that brightens on hover) → opens a popover dropdown:
  - **Root** (C, C♯/D♭ … with enharmonic toggle), **Quality** (maj, min, 7, maj7, min7, m7♭5, dim, aug, sus2, sus4, 6, 9 …), optional **Bass / slash** (for `C/E`).
  - Symbols follow **lead-sheet convention** (Berklee — see [`musicxml-guidelines.md`](../docs/musicxml-guidelines.md)): minor = `mi`/`–` (not bare `m`), `Maj7`, `+`, `°`, `ø`, tensions in parens — written to `kind/@text` so the chart reads professionally. Quality maps to the fixed `kind-value` enum.
  - Live preview of the symbol text; **Apply** / **Remove**. Keyboard: type-ahead in root, Esc to cancel, Enter to apply.
  - Existing chords render as clickable pills above their beat; clicking re-opens the same dropdown pre-filled.
- **Section marks — draggable.** `＋Section` drops a labeled pill (Intro / Verse / Chorus / Bridge / Solo / Outro / custom) at the start of the nearest bar. Drag horizontally → snaps to the nearest barline. Click to rename, ⌫/right-click to remove.
- **Annotations (notes) — draggable.** `＋Note` drops a small free-text sticky anchored to a bar; drag to re-anchor (snaps to bar), click to edit text, remove via ⌫.
- **Slashes — always on (M9).** Every bar renders a uniform per-beat slash grid automatically (§6.5); there is no per-bar on/off control in the chart view. _(The earlier per-bar slash **toggle** is deferred — **P11** — moot while all bars show slashes; it re-emerges only with note display, P10.)_
- **Key:** dropdown of key signatures (relabel only — does NOT move pitches).
- **Transpose:** stepper (semitones, −12…+12) or interval picker — DOES move pitches and updates the key signature. Distinct control from Key.
- **Enharmonic relabel:** right-click a note or a chord root → "Respell" (F♯↔G♭ etc.). Spelling only, no pitch change.
- **Tempo/BPM:** numeric input; updates playback and the written tempo.

### 6.4 Feedback

- **Selected bar:** a **warm-gray border + light warm-gray fill** (translucent, so the staff stays legible) — _not_ the accent. **Decided in M5** (`docs/ui-decisions.md` A2/B5.1/B5.4): the single orange accent is reserved for the **playback position**, so selection and the playing bar are distinguished by _hue_ (gray vs orange) and can never be confused. Idle bars show no hover affordance (the hover cue belongs to individual items — see below); Esc or a click on empty desk deselects. _(This supersedes the original "2px accent outline + accent-tint fill" selection styling.)_
- **Playing bar:** a soft orange `--accent-tint` wash over the whole current measure — the playhead (M5 replaced M2's thin-line cursor with this). While playing, hovering another bar previews it in light orange and a click **seeks** the playhead there and continues.
- **Item-level (M6/M7):** hovering an individual item (note, chord, section/annotation) highlights **just that item in 100% accent**, and selecting a bar highlights all items inside it. Editing is figure-level: select a slash → **＋** add a chord; click a chord → **edit** it (chord audition happens inside the editor). Deferred to M6 (chords) / M7 (sections) — needs per-item projection (`docs/ui-decisions.md` B6/B7).
- Undo/redo buttons disabled (faint) when stack is empty.
- Toast (quiet, bottom-left) on Download and on parse errors.

### 6.5 Chord-chart rendering model (the simplified view)

> **Added 2026-06-15** from the extended-team feedback (§1 positioning). Reframes what the score _shows_.

The score renders as a **minimal chord chart**, not standard notation. From the loaded MusicXML the view draws **only**:

- **Bars** — one box per `<measure>`; original **barline types preserved** (e.g. `‖` double bars, repeats render where present).
- **A per-beat slash grid** — every bar shows a uniform set of rhythm slashes, **N = the time signature's beat count (the numerator):** 4/4 → 4, 3/4 → 3, 6/8 → 6, 7/8 → 7. (Compound-meter _felt-pulse_ grouping — 6/8 → 2 — is the post-MVP alternative, **P15**.) Uses the bar's governing meter — the single meter for the MVP (M8 / **P14**).
- **Chord symbols** — the M6 HTML pills (§6.3), anchored above the slashes. **Multiple chords per bar** are allowed; a chord whose beat offset lands between slashes snaps to the **nearest slash**.
- **Section marks + annotations** — the M7 overlays (§6.3), carried over unchanged.
- **A double barline at every section start** — a bar that begins a section opens with a **double barline** (`<barline location="left" bar-style="light-light">`), the chart convention that a new section starts here (the **first bar of the chart is exempt**). This is **persisted** in the MusicXML (not display-only), so it round-trips on download — see M9.
- The **time signature**, drawn once at the start of each system / page.

**Not drawn:** the **clef**, the **key-signature glyph**, and any **written melody**. On load every bar is **normalized to the slash grid in the real DOM** (the chart's bars become uniform per-beat slashes) — the source note content is _replaced_, not merely hidden. A chord chart has no melody.

**How (M9).** On **load**, every bar is normalized to the per-beat slash grid in the **real DOM** (`applySlashGrid`, run alongside the key/tempo defaults), so the editable document _is_ the slash chart and a chord attaches to any beat. The OSMD **render clone** (`buildRenderDoc`) then hides the clef + key signature and OSMD's own slash/stem glyphs (painted transparent), while we draw our **own minimal slash marks** (`SlashLayer`) centered on the staff — positioned from the **staff-line geometry**, so independent of chords/stems. Real edits (chords, sections, meter) go through the command layer. Invariant #2 holds against the **normalized-on-load baseline** (exactly like the M4 key/tempo defaults): an unedited bar serializes identically to that baseline. Chord/section/annotation overlays project onto the slash onsets.

### 6.6 Page layout & view modes (A4)

> **Added 2026-06-15.** "Render the score as pages" — an A4, print-friendly layout, toggle-able with the continuous view.

The chart has **two view modes**, toggled from the topbar (§6.2):

- **Page layout (A4)** — the chart laid out on **A4 portrait** sheets, broken into **multiple pages** as needed; page breaks fall **between systems, never mid-bar**. **4 bars per row**, fixed (source `<print>` system breaks are ignored here in favor of a consistent grid). **Page 1** carries the document header (title + Key · Tempo subline, M4); **later pages** show a **page number** only. This is the **print-friendly** view — browser **Print** (M7) reproduces it cleanly (true page breaks, no clipping).
- **Fullscreen (continuous)** — today's single continuous, responsive, zoom-to-fit scroll (no page concept), best for fluid editing.

All editing interactions (select, chord add/edit, section/annotation drag, meter edit) work in **both** modes, and overlays project in both. The default mode is a small M10 call (leaning **page layout**, matching the "render as pages" intent).

**Foundation.** The paginated render reuses the **hidden second OSMD instance at `pageFormat: 'A4_P'`** scoped for the clip-free print / PDF work (post-MVP **P4**) — OSMD lays the score onto A4 pages and breaks only between systems. M10 builds this for the on-screen page view **and** clean browser Print; a downloadable **A4 PDF** (svg2pdf.js + jsPDF) layers on top and stays in **P4**.

---

## 7. Architecture

### 7.1 Stack

- **Vite + React + TypeScript.**
- **opensheetmusicdisplay** (OSMD) — rendering. MIT.
- **Web Audio soundfont (e.g. `soundfont-player`)** — for **chord realization** (M2), the primary audio path: we synthesize block chord voicings from `harmony`, scheduled to note/slash onsets read from the DOM. `osmd-audio-player` is optional and secondary — it plays the _written_ notes, which on chord charts are placeholder pitches we don't want; if used at all, mute its note audio and keep it only for cursor/timing. _(Verify package/API at install; flag in M2 PR.)_
- **lucide-react** — icons.
- Native **DOMParser / XMLSerializer** — MusicXML read/write. No MusicXML writer dependency.
- **fflate** (or `jszip`) — only to unzip `.mxl` on read.
- No state library needed; a small store (Zustand optional) is fine. Keep it light.

### 7.2 The triad

```
        ┌─────────────┐  apply()      ┌──────────────┐  render()   ┌──────────┐
 UI ───▶ │  Command     │ ───────────▶ │ MusicXML DOM │ ──────────▶ │  OSMD    │
         │  (+ inverse) │              │  (Document)  │             │  (view)  │
         └─────┬───────┘              └──────┬───────┘             └────┬─────┘
               │ push                         │ serialize                │ layout boxes
               ▼                              ▼                          ▼
         Undo/Redo stack            Download .musicxml          Overlay projector
                                                                 (chords/sections/notes)
```

### 7.3 Command layer (the spine — build in Milestone 3)

```ts
interface Command {
  label: string; // for debugging / future history UI
  apply(doc: Document): void; // mutate DOM in place
  invert(doc: Document): Command; // produce the reversing command (capture pre-state on creation)
}
```

- A `History` holds `undo: Command[]` and `redo: Command[]`.
- `dispatch(cmd)`: capture inverse → `cmd.apply(doc)` → push inverse to undo → clear redo → re-render OSMD → re-project overlays.
- Every feature ships as one or more command factories. **Adding note-level editing later = adding command types, nothing else.**

PoC command set:
`SetKeySignature`, `Transpose`, `RespellPitch` (note), `RespellChordRoot`, `SetTempo`, `SetChord` (add/edit), `RemoveChord`, `ToggleBarSlashes`, `AddSection`, `MoveSection`, `RenameSection`, `RemoveSection`, `AddAnnotation`, `MoveAnnotation`, `EditAnnotation`, `RemoveAnnotation`.

> **Inverse strategy:** snapshot the affected subtree's outerHTML (or the precise old attribute values) at command-creation time; the inverse restores it. Simple and robust for sparse edits — avoid clever diffing for the PoC.

### 7.4 Overlay projector (build in Milestone 5)

OSMD renders SVG. Editable affordances (chord anchors, section pills, annotations, selection) live in an **absolutely-positioned HTML layer** over the SVG, so they're easy to style and drag.

- After each render, walk OSMD's graphical model (`osmd.GraphicSheet.MeasureList`) to read each measure's bounding box and staff position; compute **beat anchor x-coords** from time signature.
- Store overlay items by **logical anchor** `{ measureIndex, beat }`; project to pixels on render + on `ResizeObserver`. Never store pixel positions.
- Dragging updates the _logical_ anchor on drop (snap to nearest bar/beat), then dispatches a `Move*` command.

### 7.5 Load/Save adapter (the future-backend seam — Milestone 1 & 7)

```ts
interface ScoreIO {
  load(): Promise<string>; // returns MusicXML text
  save(xml: string): Promise<void>; // persist corrected MusicXML
}
```

- **PoC impl `LocalFileIO`:** `load` = file upload/unzip; `save` = trigger browser download.
- **Future impl `BackendIO`:** `load` = `GET /scores/:id`; `save` = `PUT /scores/:id`. Swapping is a one-line provider change. Do not let upload/download logic leak into components.

---

## 8. Feature Specs — MusicXML mappings

> All edits operate on the parsed `Document`. Beat positions use `<attributes>/<divisions>` for the measure; chord `<offset>` is in divisions.
> **Spec of record:** the [MusicXML 4.0 reference](https://www.w3.org/2021/06/musicxml40/) (§16). Verify element structure/child order/enumerations against it before implementing any read or edit.

| Feature                             | MusicXML target                                                                     | Notes                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Key signature (relabel)**         | `measure/attributes/key/fifths` (+ `mode`)                                          | Display only. No pitch change. Applies from the measure where the key element lives onward. Patch only `fifths`/`mode`; **preserve** sibling `cancel`, `key-octave`, and the `number` (per-staff) + `print-object` attributes. Reading: handle all `mode` values (`major`/`minor`/`dorian`/`phrygian`/`lydian`/`mixolydian`/`aeolian`/`ionian`/`locrian`/`none`); degrade gracefully on non-traditional keys (`key-step`/`key-alter`). |
| **Transpose (global)**              | every `note/pitch` (`step`,`alter`,`octave`) **and** `key/fifths`                   | Interval/semitone shift by **rewriting written pitches** — do **not** touch the `<transpose>` element (that encodes _instrument_ written-vs-sounding transposition, not a move request; leave any existing one intact). Needs an enharmonic spelling policy. Round-trip safe against the load baseline (±n then ∓n = identical). |
| **Enharmonic respell (note)**       | one `note/pitch` `step`+`alter`                                                     | Same sounding pitch, different spelling.                                                                                                         |
| **Enharmonic respell (chord root)** | one `harmony/root` `root-step`+`root-alter`                                         | Spelling only. (Root may instead be a `numeral` or `function`; PoC edits `root` only but must not corrupt the others.)                          |
| **Tempo / BPM**                     | `direction/sound[@tempo]` (+ optional visible `direction/direction-type/metronome`) | Quarter-notes per minute; `sound[@tempo]` drives playback, `metronome` is the printed mark — keep them in sync. **A file may have no tempo at all** (real pipeline output often does) and tempo can change mid-piece. `SetTempo` must _create_ both at measure 1 when absent, not assume one exists; playback uses a default (e.g. 120) until set. |
| **Chord (per beat)**                | `harmony` with `root` (+`kind`, optional `bass`) and `offset` (divisions)           | Schema child order is significant: `root`→`kind`(req)→`inversion`→`bass`→`degree`→`frame`→`offset`→`staff`. On edit, patch `root`/`kind`/`bass` and **preserve** `inversion`/`degree`/`frame`, the `kind/@text` (displayed label, e.g. "maj7"), and `harmony/@type` (`explicit`/`implied`/`alternate`). Dropdown maps UI qualities → the fixed `kind-value` enum (`major`,`minor`,`dominant`,`major-seventh`,`minor-seventh`,`half-diminished`,`diminished`,`augmented`,`suspended-second`/`-fourth`,`major-sixth`/`minor-sixth`,`dominant`/`major`/`minor`-`ninth`/`11th`/`13th`,`power`,`none`, …). Inserted before the note at that beat. |
| **Slashes (per beat, all bars)**    | per-note `note/notehead` `slash`, N = meter numerator                               | **M9 (§6.5):** every bar is **normalized to a uniform per-beat slash grid in the real DOM on load** (`applySlashGrid`) — source notes replaced by slashes, so the editable chart == the displayed chart and a chord attaches to any beat. Per-note `<notehead>slash</notehead>` (S1 spike, §11). On screen, OSMD's slash glyphs are hidden and our **own** minimal marks drawn (`SlashLayer`, centered via staff geometry). Supersedes the per-bar `ToggleBarSlashes` _toggle_ (parked in **P11**). |
| **Section mark**                    | `direction/direction-type/rehearsal` (`enclosure="square"`), `placement="above"`, one per measure (keyed by `measureIndex`)    | Named section. Draggable = move the `direction` to another measure; preserve `enclosure`, parent `placement`, positioning and text-formatting attributes on the move. _(Implemented M7.)_                                |
| **Annotation**                      | `direction/direction-type/words`, `placement="above"`, one per measure; `<direction>` tagged `data-musipad="annotation"`        | Free text (no enclosure). Survives in the downloaded file. Draggable = re-parent; preserve formatting/positioning attributes + the `data-musipad` tag. The tag identifies MusiPad notes by content, not position (distinguishing the Feel/style `<words>`, the first untagged `<words>` in measure 1). `data-*` is a non-schema attribute — see M7 known trade-off (§9). _(Implemented M7.)_          |

> Keeping sections/annotations **in the MusicXML** (rehearsal/words) means they round-trip on download with no sidecar — consistent with Invariant #2.

---

## 9. Milestones (build in order)

Each milestone is independently runnable and demoable.

### M0 — Scaffold

- Vite + React + TS. Install OSMD, lucide-react, fflate. ESLint/Prettier.
- Apply design tokens (§6.1) globally; build empty-state dropzone.
- **AC:** App boots; dropzone visible; tokens applied.

### M1 — Load + Render (+ `ScoreIO`)

- `LocalFileIO`: file picker + drag-drop; unzip `.mxl`; produce MusicXML text.
- Parse to `Document`; render with OSMD into the paper canvas. Proportional zoom-to-fit (no reflow); lead-sheet line breaking (~4 bars/line, honoring explicit `<print>` breaks).
- Preserve the XML declaration + DOCTYPE through parse→serialize; establish the normalized-on-load baseline (Invariant #2).
- Read-only header chips: **Key**, **Tempo/BPM**, **Feel** (style marking) — derived from the DOM (`model/scoreInfo.ts`).
- **Spike:** confirm slash rendering behavior in OSMD; record finding in PR.
- **AC:** Drop a sample MusicXML → it renders (~4 bars/line). `.mxl` works. Resize scales the page proportionally. Header shows Key/Tempo/Feel (or "—"). Parse→serialize keeps the declaration/DOCTYPE and round-trips to the load baseline.

### M2 — Playback (chord-chart realization)

- **Chord realization (the headline feature).** Build the playback schedule from the DOM: read note/slash **onsets** (rhythm, via `<divisions>`) and the **active harmony** at each onset (the last `harmony` at or before that beat). At each onset, sound the active chord as a **block voicing** (root-position triad, or 7th when the `kind` implies one; bass note in the low register for slash chords) for the onset's duration, via a Web Audio soundfont. **Do not play the written placeholder pitches.** Reflects edits to tempo, transpose, and chord changes.
  - Voicing is derived from `kind-value` → chord-tone intervals (e.g. `major`→0,4,7; `minor`→0,3,7; `dominant`→0,4,7,10; `major-seventh`→0,4,7,11; `half-diminished`→0,3,6,10; `suspended-fourth`→0,5,7; …). Root from `root-step`+`root-alter`. Fixed mid register.
  - If no harmony is active at an onset (gap), play nothing for that onset (or carry the previous chord — decide in M2).
- **Transport:** play/pause/seek; playhead in `--accent` synced to position (use OSMD's cursor for the visual playhead; timing driven by the schedule above). `osmd-audio-player` is optional — if used, its note audio is muted and we inject chord audio; otherwise drive timing ourselves.
- **Metronome toggle** (§6.2): footer toggle that, when on, emits an audible click per beat synced to the current tempo (BPM) via Web Audio. Off by default; follows tempo edits and play/pause/seek state. Tempo defaults (e.g. 120) when the file has none (§8, §11).
- **AC:** Pressing play **sounds the chords** in the chart's rhythm (e.g. Em, A, D… as block chords), not the placeholder pitches; pause/seek work; playhead tracks position. Changing tempo changes playback speed; metronome toggle on → beat clicks at tempo, off → silent.

### M3 — Command layer + Undo/Redo

- Implement `Command`, `History`, `dispatch`. Wire topbar Undo/Redo (with disabled states + ⌘Z / ⌘⇧Z).
- Migrate any existing mutation through it.
- **AC:** A trivial command (e.g. SetTempo) applies, undoes, redoes correctly; OSMD re-renders each time.

### M4 — Global edits (Key, Transpose, Tempo)

- Key dropdown (relabel). Transpose stepper (pitches + key). Tempo input (drives playback).
- **Title header block** (promoted from post-MVP P1): render **Key · Tempo · Feel** as a subline under the song title; it reflects edits live (the M3 inline marks were removed — see `drawMetronomeMarks`/`buildRenderDoc`). App-display only; the print-embedded version stays in P4.
- `SetTempo` also completes the partial-sync case here: when only one of `sound[@tempo]`/`metronome` exists, create the missing partner (PRD §8).
- **Transpose spelling is key-aware:** for the requested chromatic interval, pick the letter-step count whose resulting `fifths` has the fewest accidentals — keeping the key within OSMD's renderable ±7 (beyond it OSMD throws) and conventionally spelled (C major +2 → D major; A major −1 → A♭ major). Chords (`harmony` root + bass) transpose too — they're the visible/audible content of a chord chart.
- **Missing-data defaults (M4):** when a loaded file has no key and/or tempo (§11), assign defaults (**C major** / **120 BPM**) into the DOM on load and show a **dismissible alert** above the sheet, so the chart is always editable and playable. Feel/style is optional and not surfaced in the M4 UI (the reader stays; display/edit is post-MVP).
- **Note (build):** the read-only Key/Tempo/Feel topbar chips (M1) were removed as redundant with the toolbar controls + the title subline. The subline shows Key · Tempo; the title renders as an HTML document header on the score sheet, which keeps A4 proportions.
- **AC:** Each is a command (undoable). Transpose +2 then −2 → DOM identical to the load baseline. Tempo change audibly changes playback (creating `sound[@tempo]`/`metronome` if the file had none, keeping the two in sync). The title subline shows Key/Tempo and updates when they're edited.

### M5 — Overlay projector + Selection + bar-highlight playhead + auto-scroll

- Build the HTML overlay layer; derive measure boxes from OSMD graphics; logical→pixel projection on render. The overlay is mounted **inside the scaled layer**, so the existing zoom-to-fit `transform: scale()` re-projects it for free on resize (still Invariant #4: derived from OSMD graphics every render, never persisted as pixels). Per-beat anchors are computed as **invisible scaffolding** here (B5.7) and rendered only from M6.
- Bar selection (click bar background). **Decided (§6.4, `docs/ui-decisions.md`):** selection is a **grayscale fill**, _not_ the accent — the accent is reserved for the playing bar, so the two are distinguished by hue. Faint gray hover; Esc / desk-click to deselect.
- **Bar-highlight playhead** (promoted from post-MVP P3): drive a full-measure highlight from the transport so the **whole current measure** gets a soft orange `--accent-tint` wash during playback — **replacing** the M2 thin-line cursor (which is fully disabled). Driven by `TransportState.currentMeasure`, computed in the `Player` from the schedule's `measureStartQuarters` (off the same audio clock, no OSMD dependency).
- **Auto-scroll** (promoted from post-MVP P3): keep the playing bar in view during playback, nudging only when it drifts outside a comfortable band so it doesn't fight the user.
- **AC:** Bars sit correctly over the measures; survive resize; bar selection visible (grayscale); during playback the current measure is highlighted (orange) and advances in time; the playing bar auto-scrolls into view on long charts.

### M6 — Chords (dropdown)

Ships in **two PRs** (see `docs/ui-decisions.md` B6).

- **M6a (built):** render existing chords as our **own clickable HTML pills** styled to match OSMD's engraving (OSMD glyphs suppressed; pills anchored over the slash by graphical staff-entry x, in OSMD's reserved chord row). An **editable-combobox** chord editor popover — type or pick the root's qualities → Berklee-house-style normalize — for **add** (hover an empty slash → ＋), **edit/remove** (click a pill), all → `harmony`, all undoable; in-editor **audition** (▷ Hear + auto-audition on apply). Chord editing is kept separate from note editing. Add/edit/remove are measure-scoped commands (snapshot inverse).
- **M6b (dropped):** a structured **root/quality/bass picker** + **enharmonic toggle** + **respell** was prototyped but **cut as too complex for the MVP** (2026-06-08) — the shipped editor is the dropdown above. The ideas are parked in [`post-mvp-improvements.md`](./post-mvp-improvements.md) **P8**; note respell still lands in M7. Typing already covers every spelling/quality/slash chord.
- **AC:** Add a per-beat chord; it persists in download; edit & remove work; all undoable. ✅ **Met (M6, [PR #9](https://github.com/nndrch/MusiPad/pull/9)).**

### M7 — Sections, Annotations, Download + Print

- **Sections + Annotations** — two chart-authoring marks, both stored as standard MusicXML `<direction placement="above">` in the part. **Section** = boxed rehearsal mark (`<direction-type><rehearsal enclosure="square">LABEL</rehearsal>`); **Annotation** = free text (`<direction-type><words>TEXT</words>`, the `<direction>` tagged `data-musipad="annotation"` so MusiPad-authored notes are identified by content, not document position — protecting the Feel chip, the first untagged `<words>` in measure 1). One section + one annotation max per measure, keyed by `measureIndex` (snap-to-bar). Authoring: toolbar **＋Section** preset dropdown (Intro/Verse/Chorus/Bridge/Solo/Outro/Custom…) and **＋Note** button; target = the selected bar, else the first bar with no mark of that kind (auto first-empty, so a toolbar add never overwrites; no-op if all occupied and nothing selected). Inline edit (click → input, Enter commit / Esc cancel / blur commit); drag to snap a mark onto another bar (move command, whole-part snapshot undo); remove via Backspace / ×. All undoable. Marks are HTML overlays drawn by `overlay/MarkLayer.tsx` (mounted twice — `variant="section"`/`variant="annotation"`), stripped from the OSMD render clone (`buildRenderDoc`) so OSMD doesn't double-draw them.
- `LocalFileIO.save` → serialize DOM → download `.musicxml`.
- **Print** (promoted from post-MVP P4): a Print button beside Download that prints the score via `@media print` CSS — score only (topbar/transport/cursor/overlays hidden). Full client-side **A4 PDF generation** stays in P4.
- **De-scoped to post-MVP (2026-06-08):** two **note-level** items cut from M7 (value needs note editing P9/P10; our chart notes are un-played slash placeholders) — **per-bar slash toggle → P11** (built, on `post-mvp/slash-toggle`); **note respell + the A3 right-click context menu → P12**. (So section/annotation **remove** uses ⌫/×, not A3.)
- **Known trade-off ([P13](./post-mvp-improvements.md)):** `data-musipad="annotation"` is a non-schema custom attribute on `<direction>` — the W3C MusicXML XSD doesn't define `data-*`, so a strict schema validator could reject a downloaded file. Accepted for robust annotation identification; a schema-legal carrier is a future item.
- **AC:** Add a section (boxed rehearsal) and an annotation (free words); drag a mark to another bar; all undoable; download → reopening the file shows all edits; unedited measures identical to the load baseline; declaration/DOCTYPE intact; Print produces a clean score-only page. ✅ **Met (M7, [PR #15](https://github.com/nndrch/MusiPad/pull/15)).**

### M8 — Meter / time-signature editing

Promoted from post-MVP **P7** in the M6 3-milestone re-weigh (CLAUDE.md rule 6, 2026-06-08): its own focused milestone after M7 rather than bloating M7's scope.

- Make the time signature on the staff **hover/click-editable like chords** (reuse the M6 hover-popover + figure-level overlay pattern): hover the `4/4` → a small "beats / beat-type" popover; commit via an **undoable `Command`** patching `attributes/time` (`beats` + `beat-type`), preserving siblings (`@symbol`, `interchangeable`, `senza-misura`) per Invariant #2.
- **Not just a label:** meter feeds the beat math — the metronome click grid + measure lengths in `schedule.ts` and the slash-rhythm grid — so an edit must re-derive playback and re-project the overlay. PoC scope may limit to the first/active meter (like Key); mid-piece `<time>` changes are a further wrinkle.
- **AC:** Edit a bar's meter (e.g. `4/4` → `3/4`); it persists in the DOM/download; the metronome grid, measure length, and slash grid re-derive to match; undoable; unedited measures identical to the load baseline. ✅ **Met (M8, [PR #16](https://github.com/nndrch/MusiPad/pull/16)).**

### M9 — Simplified chord-chart rendering (slashes + chords only)

Reframe the view to the minimal chord chart of §6.5 — the headline of the post-M8 extended-team feedback (§1 positioning). Render **only** bars + a per-beat slash grid + chord symbols (plus the M7 section/annotation marks + the time signature); hide the clef, key-signature glyph, and the written melody.

- On **load**, normalize every bar to a uniform per-beat slash grid in the **real DOM** (`applySlashGrid`, N = the active meter's numerator, reusing M8's beat math), so the editable chart _is_ the slash chart and a chord attaches to any beat. The OSMD **render clone** (`buildRenderDoc`) then hides the clef + key signature and OSMD's own slash/stem glyphs; we draw our **own minimal slash marks** (`SlashLayer`) centered on the staff — positioned from the staff-line geometry, so independent of chords/stems.
- Chords / sections / annotations project onto the slash onsets. Because the real DOM is the grid, a chord attaches to **any** beat of **any** bar (the former mismatch — a chord couldn't be added to a beat lacking an underlying note — is gone).
- **Section-start double barline.** A bar that starts a section opens with a double barline (first bar exempt). It is **drawn as our own overlay** (`MarkLayer`, from section presence — so it shows for add _and_ move, spanning the staff) and **persisted** as `<barline location="left" bar-style="light-light">` in the DOM (the M7 `AddSection`/`MoveSection`/`RemoveSection` commands manage it; a load-time pass adds it to pre-existing sections). The persisted barline is stripped from the render clone so OSMD doesn't double-draw it.
- **Rendering (resolved):** OSMD draws the staff + bars + time signature and supplies per-beat x-positions; the clef, key, and OSMD's slash/stem glyphs are suppressed, and we overlay our own minimal slashes (centered via the staff-line geometry) + section dividers. **Playback and Download are disabled** for this milestone (re-enabled later).
- **AC:** A loaded chart renders as the §6.5 minimal view — bars + N slashes/bar (centered on the staff) + chord pills + section/annotation marks + time signature, **no clef / key glyph / melody**; a **chord can be added to every beat of every bar**; a bar that **starts a section opens with a centered double barline**; undo/redo reverts edits; an unedited bar serializes identically to the normalized-on-load baseline.

### M10 — A4 page layout + view toggle + print

Add the **page-layout** view of §6.6 and the **page-layout ↔ fullscreen** toggle.

- Paginated **A4** render via a hidden second OSMD at `pageFormat: 'A4_P'` (the **P4** foundation): A4 portrait sheets, **4 bars/row** fixed, page breaks **between systems only**. **Page 1** header (title + Key · Tempo); later pages a **page number** only.
- Topbar **view toggle** (Page ▾ / Full). Fullscreen = the existing continuous zoom-to-fit scroll. Editing interactions and overlay projection work in **both** modes.
- **Print** (M7) now reproduces the A4 page layout cleanly — multi-page, **no mid-system clipping** — closing the M7 known limitation. A downloadable **A4 PDF** stays in **P4**.
- **AC:** The toggle switches between A4 pages and continuous scroll; a multi-system chart paginates onto multiple A4 sheets with breaks between systems (no clipped bars); 4 bars/row; page 1 shows the header, later pages a page number; Print outputs the clean paginated A4; all edits still work in page-layout mode; unedited bars byte-identical to the load baseline. ✅ **Met (M10).** _(Deferred: exact Berklee chord-symbol parity on print — OSMD ignores `<kind text>`, so print uses its house style; see [`post-mvp-improvements.md`](./post-mvp-improvements.md) P4. A4 **PDF download** stays P4.)_

### M11 — Drag-to-reorder chords (snap to slashes)

Promoted from post-MVP **P17** (requested 2026-06-15) — scheduled after M10. Let the user **drag a chord pill** onto another beat to move / reorder it, **snapping to the nearest slash** (beat anchor), within a bar or across bars — mirroring the M7 section/annotation drag-to-snap.

- Add drag handlers to the chord pills (§6.3, `ChordLayer`), cloning `MarkLayer`'s pointer-down/move/up → highlight-target → drop flow; a drag threshold separates a drag from the existing click-to-edit.
- Snap the drop to the nearest beat anchor `{measureIndex, entryIndex}` from the M9 slash grid (the projector already emits one anchor per beat); an off-beat `<harmony>` `offset` snaps to the nearest beat.
- New `moveChord(fromMeasure, fromEntry, toMeasure, toEntry)` — remove-then-set over `setChordAt` / `removeChordAt`, so it's undoable; dropping on an occupied slash overwrites (matches the section upsert).
- **AC:** Drag a chord to another slash (same bar and across bars) → it moves and snaps to that beat; the `<harmony>` moves with it and survives download; click-to-edit still works (drag threshold); undo/redo reverts the move. ✅ **Met (M11).**

### M12 — Polish

- Toasts, empty/error states, keyboard shortcuts, hover/active states audit against §6.
- **AC:** Feels like the §6 spec: quiet, grayscale, single orange accent, notepad calm.

---

## 10. Project structure (suggested)

```
src/
  io/            ScoreIO.ts, LocalFileIO.ts        # future: BackendIO.ts
  model/         mxlUnzip.ts, xmlDoc.ts, anchors.ts (divisions/beat math)
  commands/      Command.ts, History.ts, key.ts, transpose.ts, tempo.ts,
                 chord.ts, slash.ts, section.ts, annotation.ts, respell.ts
  render/        OsmdView.tsx, useOsmd.ts
  overlay/       OverlayLayer.tsx, projector.ts, BeatAnchor.tsx,
                 ChordPill.tsx, SectionPill.tsx, AnnotationNote.tsx
  audio/         player.ts, Transport.tsx
  ui/            Topbar.tsx, Toolbar.tsx, KeyDropdown.tsx, ChordDropdown.tsx,
                 Dropzone.tsx, Toast.tsx, tokens.css
  store/         store.ts (doc, selection, history, io)
  App.tsx  main.tsx  index.css
public/
  samples/       a few generated MusicXML files for testing
```

---

## 11. Risks & required spikes

- **OSMD slash rendering** — **resolved (S1, [`spikes.md`](./spikes.md)):** `measure-style/slash` is ignored by OSMD; use per-note `<notehead>slash</notehead>` (also what the pipeline emits). Done.
- **Minimal render (M9, done)** — the chart normalizes every bar to a per-beat slash grid in the **real DOM on load** (a deliberate transformation folded into the normalized-on-load baseline, like the M4 defaults), hides the clef/key/OSMD-slash glyphs, and overlays our **own** minimal slashes centered via the staff-line geometry (§6.5). Invariant #2 is measured against that baseline.
- **A4 pagination (M10)** — the on-screen page view + clean Print need page breaks **between systems, never mid-bar**. The single continuous SVG (zoom-to-fit) can't paginate without clipping, so reuse the hidden second-OSMD `pageFormat:'A4_P'` re-render (scoped in **P4**) — the shared core for the page view, clip-free Print, and the P4 PDF.
- **Chord realization (M2)** — the headline feature carries real risk: mapping the full `kind-value` enum → chord-tone intervals, choosing a register/voicing that sounds good, extracting rhythm from note/slash onsets across meters and large `divisions`, and syncing audio to the OSMD cursor. Budget time; cover common kinds first, degrade gracefully on exotic ones.
- **osmd-audio-player role** — secondary now (it plays written notes, which are placeholders on charts). Use a Web Audio soundfont for chord audio; if osmd-audio-player is used for timing/cursor, mute its note output. Flag the chosen approach in the M2 PR.
- **Round-trip normalization** — `DOMParser → XMLSerializer` is **not byte-identical** to the source (self-closing tags, attribute quoting, whitespace, entities all get normalized). Don't promise raw-byte fidelity; measure against a **normalized-on-load baseline** (Invariant #2). Establish the baseline in the load path (M1) and assert against it from M4 onward.
- **XML declaration + DOCTYPE loss** — `XMLSerializer.serializeToString` emits **neither** the `<?xml …?>` declaration nor the `<!DOCTYPE …>` (real pipeline files have both). Capture them on load and re-emit on save, or the downloaded file is malformed/altered. Handled in `model/xmlDoc.ts` (M1).
- **Tempo may be absent / multi-valued** — pipeline output can have no `sound[@tempo]`/`metronome` at all, and tempo can change mid-piece. Playback needs a default fallback (M2); `SetTempo` must create-when-absent and keep sound/metronome in sync (M4).
- **Reading robustness** — don't assume the happy path: handle all key `mode` values + non-traditional keys; harmony root may be `numeral`/`function`; `<divisions>` is per-measure and large (e.g. 480, 10080) — never assume 1 in beat-anchor math (M5).
- **Lead-sheet road map preservation** — charts use repeat barlines, multiple `ending`s, `segno`/`coda` + `D.S.`/`D.C.`, and explicit `<print new-system>`/`new-page` breaks to stay one page (Berklee, §16). PoC must **preserve these verbatim and render them** (OSMD handles them); editing the road map is post-MVP. Don't let any reflow/normalization drop them.
- **Beat-anchor accuracy** — deriving exact beat x-coords from OSMD graphics is the fiddly part (M5). Budget time; validate across simple & compound meters and realistic high `divisions`.
- **Transpose correctness** — alter/octave math across the staff (needs a spelling policy); do not touch the `<transpose>` element; the ±n/∓n identity test against the load baseline (M4 AC) is the guard.
- **`.mxl` write** is out of scope — write plain `.musicxml` only.

---

## 12. Acceptance (whole PoC)

A user can: drop a generated MusicXML, see it render as a **minimal chord chart** (bars + chord symbols + a per-beat slash grid; §6.5) — in either a paginated **A4 page** layout or a continuous canvas (§6.6) — fix key/tempo, transpose, edit the meter, add per-beat chords via dropdown, respell enharmonics, drag section marks and annotations onto bars, **hear the chord chart play back (chords realized in the chart's rhythm)** with a metronome, undo/redo any of it, and download a corrected `.musicxml` whose unedited regions are identical to the normalized load baseline (declaration/DOCTYPE preserved) — all in a quiet grayscale-plus-orange notepad UI.

---

## 13. Getting started (commands for Claude Code)

```bash
npm create vite@latest musicxml-editor -- --template react-ts
cd musicxml-editor
npm i opensheetmusicdisplay lucide-react fflate
# playback — verify current package & API before relying on it:
npm i osmd-audio-player
npm i -D prettier eslint
npm run dev
```

Then proceed **M0 → M12**, opening one PR per milestone, never advancing past failing acceptance criteria. Keep §4 Invariants visible in the repo (copy them into `CONTRIBUTING.md` or the top of `commands/Command.ts`).

---

## 14. Decisions log (resolved)

- Renderer: **OSMD** (over Verovio) — interactive overlays + a cursor for the playhead. (Playback itself is chord realization via Web Audio, not OSMD's note MIDI — see below.)
- Editing model: **MusicXML DOM as single source of truth**; OSMD is a view; patch-don't-regenerate.
- Key vs Transpose vs Respell: **three distinct operations** (relabel / move-pitches / spelling-only).
- Chords: **per-beat**, **dropdown** UI, written as `harmony`.
- Playback: **chord-chart realization** — sound the active chord (block triad/7th, root-position, mid register) at each note/slash onset, in the chart's rhythm; the written placeholder pitches are not played. Chord audio is the PoC headline (more central than melodic note playback).
- Sections & annotations: **draggable HTML overlays**, persisted as `rehearsal` / `words` in the MusicXML.
- Undo/redo: **command layer from the start** (growth seam for future note editing).
- UI: **Notion-like notepad**, grayscale + single orange accent (`#E8590C`).
- IO: **`ScoreIO` adapter**; PoC = local upload/download; future = backend GET/PUT (one-line swap).
- **Rendering (2026-06-15):** the chart renders **minimally** — bars + chord symbols + a per-beat slash grid only (no clef, key glyph, or melody). Every bar is normalized to that slash grid in the real DOM on load; OSMD draws the staff/bars while we overlay our own minimal slashes (§6.5). Positions MusiPad as a chord-chart editor, not a notation suite (§1).
- **Page layout (2026-06-15):** an **A4 paginated** view with a **page-layout ↔ fullscreen** toggle, for clean print (§6.6).

## 15. Open questions (for later, not blocking PoC)

- ~~Should chord symbols play back audibly?~~ **Resolved (§2, §9 M2, §14):** yes — chord realization is the PoC headline. Remaining nuances for later: voicing beyond block triads/7ths (inversions, voice-leading), handling files with a real melody (play notes too?), and whether to carry the previous chord across onset gaps.
- When backend-integrated: optimistic save vs explicit save button? conflict handling?
- Multi-part scores: PoC assumes the user works the first/primary part — confirm before multi-staff editing.
- Do generated files already contain `rehearsal`/`harmony` from MSAF/chord detection that the editor should _pre-load and correct_ (vs add from scratch)? Likely yes — verify against real pipeline output.

## 16. References

- **MusicXML 4.0 — W3C reference (spec of record):** https://www.w3.org/2021/06/musicxml40/ — element reference, data types, and DTD/schema. Consult before implementing any read/edit; element child order and enumerations are normative.
  - Element pages used by this project: [`harmony`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harmony/), [`kind` values](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/kind-value/), [`key`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key/), [`transpose`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose/), [`metronome`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/metronome/), [`slash`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/slash/), [`rehearsal`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rehearsal/).
- **MusicXML working guidelines (in-repo cheat-sheet):** [`musicxml-guidelines.md`](./musicxml-guidelines.md) — element structures, child order, `kind` enum, lead-sheet conventions, and our compliance decisions. Read before implementing any read/edit.
- **Lead-sheet conventions:** [Berklee Today — "The Lead Sheet"](https://www.berklee.edu/berklee-today/summer-2018/lead-sheet) — chord-symbol spelling, road map/navigation, style markings, legibility. Distilled into the guidelines doc above.
- OSMD slash-rendering finding: [`spikes.md`](./spikes.md) (S1).
