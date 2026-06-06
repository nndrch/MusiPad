# UI decisions — scoping worksheet

Open UI/UX decisions for the remaining milestones (M5–M8) and the post‑MVP backlog, so they can be defined deliberately rather than improvised during the build. This complements the **UI/UX spec** in [`musicxml-editor-prd.md`](./musicxml-editor-prd.md) §6 (which sets the design language and the intended interactions) and the status view in [`roadmap.md`](./roadmap.md).

**How to use this doc**

- Each item has a one‑line **Decision:** to fill in. Mark status: 🔲 open · 🟡 leaning · ✅ decided.
- When an item is decided, write the decision here and (if it refines the spec) fold it into the PRD §6 / [`musicxml-guidelines.md`](./musicxml-guidelines.md) so the spec stays the source of truth.
- Ground rules that constrain every decision (PRD §6.1): calm, content‑first, **grayscale + a single orange accent** used sparingly (active/selected/primary/playback only); **borders over shadows** (shadows only on popovers/dropdowns); thin lucide line‑icons; no gradients/heavy fills.
- Anything edit‑related must still obey the Core Invariants (PRD §4): the DOM is the source of truth, every edit is an undoable `Command`, overlays anchor to logical `{measure, beat}` positions (not pixels).

---

## 0. Settle these first (they unblock the most)

Resolving these early de‑risks the rest, because the later items inherit from them.

1. ⚑ **Chord rendering ownership** (M6) — OSMD already draws chord symbols; do we keep its text + an invisible click target, or render our own HTML pills? Gates the entire overlay/chord design. → see B/M6.
2. ⚑ **Selection + playing‑bar visual language** (M5) — one treatment reused by chords, sections, annotations, and the playhead. → see B/M5.
3. ⚑ **Popover spec** (M6) — the chord editor is the first real popover; sets the pattern for every future panel. → see A.
4. ⚑ **Default chord‑symbol house style** (M6) — the `kind/@text` we write; affects every chart's readability. → see B/M6.
5. ⚑ **Primary button + toast** (M7) — the app's first "loud" moments (Download). → see A.

---

## A. Cross‑cutting UI primitives (design once, reuse everywhere)

Each is *first needed* at the milestone noted — define it before that point.

### A1. Popover / dropdown — _first needed: M6_ 🔲
Anchoring/positioning over the scaled SVG sheet, `--shadow-pop`, max size, dismiss (click‑outside / Esc), focus management.
- **Decision:** _TBD_

### A2. Selection visual language — _first needed: M5_ 🔲
Selected element = 2px `--accent` outline + `--accent-tint` fill (PRD §6.4). Outline width, whether the tint fills the whole bar without drowning the notes, hover‑to‑show‑clickable, deselect gesture.
- **Decision:** _TBD_

### A3. Context menu (right‑click) — _first needed: M6_ 🔲
Used for "Respell" (chord root M6, note M7) and possibly section/annotation remove. Trigger, look, item style, keyboard.
- **Decision:** _TBD_

### A4. Toast — _first needed: M7_ 🔲
Quiet, bottom‑left (PRD §6.4). Position, duration, stacking, dismiss, success vs error variants. Used for Download + parse errors; polished in M8.
- **Decision:** _TBD_

### A5. Inline text edit — _first needed: M7_ 🔲
Rename a section pill, edit an annotation. Click‑to‑edit vs popover; commit/cancel keys.
- **Decision:** _TBD_

### A6. Primary (orange) button — _first needed: M7_ 🔲
Download is the *only* orange primary button (PRD §6.1/§6.2). Defines the primary‑button style; Print sits beside it as secondary.
- **Decision:** _TBD_

### A7. Overlay drag interaction — _first needed: M7_ 🔲
Drag‑handle affordance, snap‑to‑barline indicator while dragging, drop feedback. Re‑projected from logical anchors on resize (Invariant #4).
- **Decision:** _TBD_

---

## B. Per‑milestone decisions

### M5 — Overlay projector + Selection + bar‑highlight playhead

- ⚑ **B5.1 Selected‑bar treatment** — outline only / tint fill / both; opacity that doesn't obscure notes. 🔲
  - **Decision:** _TBD_
- **B5.2 Bar hover state** — do bars visibly indicate they're clickable on hover? 🔲
  - **Decision:** _TBD_
- **B5.3 Deselect gesture** — click empty desk / Esc / click again? 🔲
  - **Decision:** _TBD_
- ⚑ **B5.4 Playing‑bar vs selected‑bar differentiation** — both want `--accent-tint`; they need distinct treatments so they never look identical. 🔲
  - **Decision:** _TBD_
- **B5.5 Cursor replacement** — does the M2 thin‑line cursor get replaced by the full‑bar highlight, or do both show? (PRD M5 says replace.) 🔲
  - **Decision:** _TBD_
- **B5.6 Auto‑scroll** — keep the playing bar in view during playback, here or deferred (post‑MVP P3)? 🔲
  - **Decision:** _TBD_
- **B5.7 Beat anchors visibility** — built as scaffolding in M5; invisible until M6 or already a faint affordance? 🔲
  - **Decision:** _TBD_

### M6 — Chords (dropdown)

- ⚑ **B6.1 Chord rendering ownership** — keep OSMD's drawn symbols + invisible click target, **or** hide OSMD text and render our own HTML pills. Architectural; shapes everything below. 🔲
  - **Decision:** _TBD_
- **B6.2 Beat‑anchor affordance** — the "ghost target above the staff that brightens on hover" (PRD §6.3): shape (＋ / dot / pill outline), size, and **density** (per beat / per slash / per division). 🔲
  - **Decision:** _TBD_
- ⚑ **B6.3 Chord‑editor popover layout** — Root + Quality + optional Bass + live preview + Apply/Remove; columns vs stacked; compactness. 🔲
  - **Decision:** _TBD_
- **B6.4 Root picker pattern** — note‑button grid vs dropdown vs type‑ahead text (PRD mentions type‑ahead). 🔲
  - **Decision:** _TBD_
- **B6.5 Enharmonic toggle** — how C♯/D♭ is surfaced (sharp/flat switch? both shown?). 🔲
  - **Decision:** _TBD_
- ⚑ **B6.6 Quality list & grouping** — the `kind-value` enum is large (see [`musicxml-guidelines.md`](./musicxml-guidelines.md)); which qualities to expose, grouping (triads / 7ths / extended / sus / 6ths), ordering. 🔲
  - **Decision:** _TBD_
- **B6.7 Bass / slash picker** — always visible or revealed on toggle; reuses the root picker? 🔲
  - **Decision:** _TBD_
- ⚑ **B6.8 Default chord‑symbol house style** — the `kind/@text` we write (mi vs – vs m; Maj7 vs Δ; °, ø, +). Pick **one** default (user‑selectable styles are post‑MVP P2). 🔲
  - **Decision:** _TBD_
- **B6.9 Existing‑chord pills** — styling, how they sit over the beat, click‑to‑reopen pre‑filled. 🔲
  - **Decision:** _TBD_
- **B6.10 Keyboard map** — Enter = apply, Esc = cancel, type‑ahead in root. 🔲
  - **Decision:** _TBD_
- **B6.11 Respell chord root** — right‑click → "Respell" (first context‑menu use, A3). 🔲
  - **Decision:** _TBD_

### M7 — Slashes, Sections, Annotations, Download + Print

- **B7.1 Slashes control** — toolbar toggle acting on the *selected* bar (depends on M5 selection); enabled/disabled logic + on/off state reflecting the current bar. 🔲
  - **Decision:** _TBD_
- **B7.2 Section pills** — `＋Section` button placement; preset label menu (Intro/Verse/Chorus/Bridge/Solo/Outro/custom) + custom entry; boxed/enclosure styling (rehearsal convention); rename UI; remove affordance. 🔲
  - **Decision:** _TBD_
- **B7.3 Annotations** — `＋Note` button; plain sticky styling (no box, contrasting sections); edit‑text + remove; how it differs visually from a section. 🔲
  - **Decision:** _TBD_
- **B7.4 Note respell** — right‑click note → "Respell" (context menu, A3). 🔲
  - **Decision:** _TBD_
- ⚑ **B7.5 Download** — placement (topbar right), the single orange primary (A6), downloaded filename convention, success toast (A4). 🔲
  - **Decision:** _TBD_
- **B7.6 Print** — placement beside Download (secondary); **what prints** (`@media print`, score only — hide topbar/toolbar/transport/cursor/overlays); does the **title/subline header** print? (the *embedded* subline is post‑MVP P4). 🔲
  - **Decision:** _TBD_

### M8 — Polish

- **B8.1 Keyboard shortcut map** — beyond ⌘Z/⌘⇧Z: space = play/pause? Delete = remove selected? Esc conventions. 🔲
  - **Decision:** _TBD_
- **B8.2 Empty / error state polish** — dropzone, parse error, render error. 🔲
  - **Decision:** _TBD_
- **B8.3 Hover/active audit** — consistency pass against §6.1. 🔲
  - **Decision:** _TBD_
- **B8.4 Toast polish** — finalize the system started in M7 (A4). 🔲
  - **Decision:** _TBD_

---

## C. Deferred (post‑MVP) — for awareness

UI decisions that live in [`post-mvp-improvements.md`](./post-mvp-improvements.md); listed so they aren't forgotten when their milestone arrives.

- Instrument / synth‑voice picker in the transport + auto‑scroll follow (P3).
- Chord‑symbol **house‑style picker** (user choice of mi/–/Δ etc.) (P2).
- Road‑map editing — repeat barlines, endings, segno/coda/D.S. (P2).
- **Feel/style display + editor** — the reader already exists in `scoreInfo`; only UI is deferred (P2).
- A4 **PDF export** options — page size, margins, fit‑to‑page (P4).
- Music/text **font + engraving typography** (P1).
- **Disable edits while playing** (or preserve play position across a schedule rebuild) (P5).
- **Louder warning/alert** styling vs the current grayscale empty‑state treatment (P5).

---

## D. Decision log

Record resolved decisions here (date — item — outcome), so the rationale survives.

- _none yet_
