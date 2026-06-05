# PRD & Build Guide — In-Browser MusicXML Revision Tool (PoC)

> **Audience:** Claude Code (and the human driving it).
> **Status:** PoC scope, locked. Designed to grow into a fuller note-taking/notation tool later.
> **How to use this doc:** Build in the numbered **Milestones** order (§9). Each milestone has acceptance criteria — do not advance until they pass. Honor the **Core Invariants** (§4) on every change.

---

## 1. Context & Problem

An upstream "audio-to-preproduction" pipeline (Demucs, Basic Pitch, MSAF, madmom, key/tempo estimation) turns audio into a MusicXML score. The output is a good start but **inaccurate** — wrong chords, mislabeled sections, off key/tempo. There is currently no way for a human to correct it without leaving for desktop software.

This tool is a **browser-based correction layer**: load the generated MusicXML, fix the high-value metadata (chords, sections, key, tempo, slashes), hear it back via MIDI, and export a corrected MusicXML. It is **not** a blank-canvas notation editor and does **not** need publishing-grade engraving.

## 2. Goals

- Load a MusicXML (`.xml` / `.musicxml` / `.mxl`) in the browser and render it.
- Correct: **key signature**, **transpose**, **enharmonic spelling** (per chord/note), **tempo/BPM**, **per-beat chord symbols** (dropdown UI), **per-bar rhythm slashes**, **draggable section marks and annotations**.
- **In-browser MIDI playback** that reflects edits (tempo, transpose).
- **Undo/redo** for every edit.
- Export the corrected MusicXML as a download.
- A calm, minimal, **Notion-like "notepad"** UI.

## 3. Non-Goals (PoC)

- No backend, no auth, no persistence beyond download. (Designed for easy backend swap later — see §10.)
- No note **entry**/deletion, no beaming/voicing/lyrics editing, no engraving controls.
- No audible playback of chord _symbols_ (notes play; harmony symbols are visual only for now).
- No `.mxl` _writing_ (read `.mxl` is fine via unzip; write plain `.musicxml`).
- No mobile-first layout (desktop browser is the target).

## 4. Core Invariants (apply to every change)

1. **The model is the MusicXML DOM.** Parse once with `DOMParser`; OSMD is a _view_ re-rendered from the DOM. There is no second source of truth.
2. **Patch, don't regenerate.** Every edit mutates only the specific nodes it touches. Unedited measures must serialize **byte-identical** to input. This protects upstream data (Basic Pitch notes, stems metadata, etc.).
3. **Every edit is a Command.** No component mutates the DOM directly. All mutations go through the command layer (§7) so undo/redo and future features come for free.
4. **Overlays anchor to logical positions, not pixels.** Section marks/annotations store `{measureIndex, beat}`, re-projected to screen coords on every render/resize.
5. **Keep it boring where it can be.** Add structural seams (command layer, load/save adapter) but no speculative features. Simplicity now, extensibility at the seams.

---

## 5. User Flow (PoC)

```
Upload MusicXML  →  Preview (render)  →  Edit  →  Play (MIDI)  →  Download corrected MusicXML
```

- **Upload:** drag-drop or file picker. Accept `.xml`, `.musicxml`, `.mxl`. (`.mxl` = zip; unzip to the root `.xml`.)
- **Preview:** OSMD renders the score on a paper-like canvas.
- **Edit:** toolbar + inline controls + draggable overlays (details §6, §8).
- **Play:** transport bar; in-browser playback via Web Audio soundfont.
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
│  Topbar:  [file name]            [Undo][Redo]   [Download]  │  ← slim, --surface
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

### 6.3 Editing interactions

- **Chords — dropdown UI.** Click a beat anchor (small ghost target above the staff that brightens on hover) → opens a popover dropdown:
  - **Root** (C, C♯/D♭ … with enharmonic toggle), **Quality** (maj, min, 7, maj7, min7, m7♭5, dim, aug, sus2, sus4, 6, 9 …), optional **Bass / slash** (for `C/E`).
  - Live preview of the symbol text; **Apply** / **Remove**. Keyboard: type-ahead in root, Esc to cancel, Enter to apply.
  - Existing chords render as clickable pills above their beat; clicking re-opens the same dropdown pre-filled.
- **Section marks — draggable.** `＋Section` drops a labeled pill (Intro / Verse / Chorus / Bridge / Solo / Outro / custom) at the start of the nearest bar. Drag horizontally → snaps to the nearest barline. Click to rename, ⌫/right-click to remove.
- **Annotations (notes) — draggable.** `＋Note` drops a small free-text sticky anchored to a bar; drag to re-anchor (snaps to bar), click to edit text, remove via ⌫.
- **Slashes — per bar.** Select a bar (click its background), toggle `Slashes` on the toolbar → adds/removes rhythm slashes for that bar.
- **Key:** dropdown of key signatures (relabel only — does NOT move pitches).
- **Transpose:** stepper (semitones, −12…+12) or interval picker — DOES move pitches and updates the key signature. Distinct control from Key.
- **Enharmonic relabel:** right-click a note or a chord root → "Respell" (F♯↔G♭ etc.). Spelling only, no pitch change.
- **Tempo/BPM:** numeric input; updates playback and the written tempo.

### 6.4 Feedback

- Selected element: 2px `--accent` outline + `--accent-tint` fill.
- Undo/redo buttons disabled (faint) when stack is empty.
- Toast (quiet, bottom-left) on Download and on parse errors.

---

## 7. Architecture

### 7.1 Stack

- **Vite + React + TypeScript.**
- **opensheetmusicdisplay** (OSMD) — rendering. MIT.
- **osmd-audio-player** — in-browser Web Audio playback synced to OSMD. _(Verify exact package name/API at install; if unmaintained vs the OSMD version pinned, fall back to manual soundfont-player + parsing note timings from the DOM. Flag in PR if so.)_
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

| Feature                             | MusicXML target                                                                     | Notes                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Key signature (relabel)**         | `measure/attributes/key/fifths` (+ `mode`)                                          | Display only. No pitch change. Applies from the measure where the key element lives onward.                                                      |
| **Transpose (global)**              | every `note/pitch` (`step`,`alter`,`octave`) **and** `key/fifths`                   | Interval/semitone shift. Round-trip safe (±n then ∓n = identical).                                                                               |
| **Enharmonic respell (note)**       | one `note/pitch` `step`+`alter`                                                     | Same sounding pitch, different spelling.                                                                                                         |
| **Enharmonic respell (chord root)** | one `harmony/root` `root-step`+`root-alter`                                         | Spelling only.                                                                                                                                   |
| **Tempo / BPM**                     | `direction/sound[@tempo]` (+ optional visible `direction/direction-type/metronome`) | quarter-notes per minute. Drives playback.                                                                                                       |
| **Chord (per beat)**                | `harmony` with `root` (+`kind`, optional `bass`) and `offset` (divisions)           | Inserted before the note at that beat in the measure. Dropdown writes `kind` (`major`,`minor`,`dominant`,`major-seventh`,`suspended-fourth`, …). |
| **Slashes (per bar)**               | `measure/attributes/measure-style/slash` (region)                                   | **Spike OSMD slash rendering first** (§11). Fallback: slash-notehead notes per beat.                                                             |
| **Section mark**                    | `direction/direction-type/rehearsal` at measure start                               | Named section; draggable = move the `direction` to another measure.                                                                              |
| **Annotation**                      | `direction/direction-type/words` anchored to a measure                              | Free text; survives in the downloaded file. Draggable = re-parent.                                                                               |

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
- Parse to `Document`; render with OSMD into the paper canvas.
- **Spike:** confirm slash rendering behavior in OSMD; record finding in PR.
- **AC:** Drop a sample MusicXML → it renders. `.mxl` works. Re-render on window resize.

### M2 — Playback

- Wire osmd-audio-player (or fallback). Transport: play/pause/seek, playhead in `--accent`.
- **Metronome toggle** (§6.2): footer toggle that, when on, emits an audible click per beat synced to the current tempo (BPM) via Web Audio. Off by default; follows tempo edits and play/pause/seek state.
- **AC:** Score plays; pause/seek work; playhead tracks position. Metronome toggle on → audible beat clicks at the song tempo; off → silent; changing tempo changes the click rate.

### M3 — Command layer + Undo/Redo

- Implement `Command`, `History`, `dispatch`. Wire topbar Undo/Redo (with disabled states + ⌘Z / ⌘⇧Z).
- Migrate any existing mutation through it.
- **AC:** A trivial command (e.g. SetTempo) applies, undoes, redoes correctly; OSMD re-renders each time.

### M4 — Global edits (Key, Transpose, Tempo)

- Key dropdown (relabel). Transpose stepper (pitches + key). Tempo input (drives playback).
- **AC:** Each is a command (undoable). Transpose +2 then −2 → DOM byte-identical to original. Tempo change audibly changes playback.

### M5 — Overlay projector + Selection

- Build the HTML overlay layer; derive measure boxes + per-beat anchors from OSMD graphics; logical→pixel projection on render/resize.
- Bar selection (click bar background → accent outline).
- **AC:** Anchors sit correctly over beats; survive resize; bar selection visible.

### M6 — Chords (dropdown)

- Beat anchors → chord dropdown popover (root/quality/bass + enharmonic). Add/edit/remove → `harmony`. Render existing chords as clickable pills.
- Right-click respell on chord root.
- **AC:** Add a per-beat chord; it persists in download; edit & remove work; all undoable.

### M7 — Slashes, Sections, Annotations, Download

- Per-bar slash toggle (or fallback). Draggable section marks (rehearsal) + draggable annotations (words), snap-to-bar.
- Note respell (right-click note).
- `LocalFileIO.save` → serialize DOM → download `.musicxml`.
- **AC:** Drag a section to another bar; add an annotation; toggle slashes; download → reopening the file shows all edits; unedited measures byte-identical.

### M8 — Polish

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

- **OSMD slash rendering** (M1 spike). If `measure-style/slash` doesn't render cleanly, use slash-notehead fallback. Decide before M7.
- **osmd-audio-player compatibility** with the pinned OSMD version. If broken/unmaintained, fall back to soundfont-player + note timings parsed from the DOM. Flag in M2 PR.
- **Beat-anchor accuracy** — deriving exact beat x-coords from OSMD graphics is the fiddly part (M5). Budget time; validate across simple & compound meters.
- **Transpose correctness** — alter/octave math across the staff; the ±n/∓n identity test (M4 AC) is the guard.
- **Round-trip fidelity** — add a test asserting unedited measures serialize identically (Invariant #2). Run it from M4 onward.
- **`.mxl` write** is out of scope — write plain `.musicxml` only.

---

## 12. Acceptance (whole PoC)

A user can: drop a generated MusicXML, see it render, fix key/tempo, transpose, add per-beat chords via dropdown, respell enharmonics, toggle slashes, drag section marks and annotations onto bars, hear the result via MIDI, undo/redo any of it, and download a corrected `.musicxml` whose unedited regions are byte-identical to the source — all in a quiet grayscale-plus-orange notepad UI.

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

Then proceed **M0 → M8**, opening one PR per milestone, never advancing past failing acceptance criteria. Keep §4 Invariants visible in the repo (copy them into `CONTRIBUTING.md` or the top of `commands/Command.ts`).

---

## 14. Decisions log (resolved)

- Renderer: **OSMD** (over Verovio) — interactive overlays + near-turnkey MIDI playback.
- Editing model: **MusicXML DOM as single source of truth**; OSMD is a view; patch-don't-regenerate.
- Key vs Transpose vs Respell: **three distinct operations** (relabel / move-pitches / spelling-only).
- Chords: **per-beat**, **dropdown** UI, written as `harmony`.
- Sections & annotations: **draggable HTML overlays**, persisted as `rehearsal` / `words` in the MusicXML.
- Undo/redo: **command layer from the start** (growth seam for future note editing).
- UI: **Notion-like notepad**, grayscale + single orange accent (`#E8590C`).
- IO: **`ScoreIO` adapter**; PoC = local upload/download; future = backend GET/PUT (one-line swap).

## 15. Open questions (for later, not blocking PoC)

- Should chord _symbols_ play back audibly (harmony → notes) in a later phase?
- When backend-integrated: optimistic save vs explicit save button? conflict handling?
- Multi-part scores: PoC assumes the user works the first/primary part — confirm before multi-staff editing.
- Do generated files already contain `rehearsal`/`harmony` from MSAF/chord detection that the editor should _pre-load and correct_ (vs add from scratch)? Likely yes — verify against real pipeline output.
