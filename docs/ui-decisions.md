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
2. ✅ **Selection + playing‑bar visual language** (M5) — **resolved**: selection = grayscale, playing = orange (distinguished by hue). Reused by chords/sections/annotations later. → see A2, B5.1, B5.4.
3. ⚑ **Popover spec** (M6) — the chord editor is the first real popover; sets the pattern for every future panel. → see A.
4. ⚑ **Default chord‑symbol house style** (M6) — the `kind/@text` we write; affects every chart's readability. → see B/M6.
5. ⚑ **Primary button + toast** (M7) — the app's first "loud" moments (Download). → see A.

---

## A. Cross‑cutting UI primitives (design once, reuse everywhere)

Each is _first needed_ at the milestone noted — define it before that point.

### A1. Popover / dropdown — _first needed: M6_ 🔲

Anchoring/positioning over the scaled SVG sheet, `--shadow-pop`, max size, dismiss (click‑outside / Esc), focus management.

- **Decision:** _TBD_

### A2. Selection visual language — _first needed: M5_ ✅

Two-level model (MuseScore-style), refined during the M5 build:

- **Bar level (M5):** selecting a bar draws a **warm-gray border + a light warm-gray fill** — two alphas of one warm gray (`rgba(120,119,116, .5)` border / `.1` fill), **never** the accent (reserved for playback). Bars show **no** idle hover affordance; the hover cue belongs to individual items. The playing bar is an **orange** wash (`rgba(232,89,12,.16)`); hue, not shape, separates selection from playback. Fills are translucent so notes stay legible.
- **Item level (M6/M7):** hovering an individual **item** (note, chord, or section/annotation) highlights **just that item in 100% accent**; selecting a bar also **highlights all items inside it**. Needs per-item projection that arrives with M6 (chords interactive) and M7 (sections/annotations exist) — see B6/B7. Notes get per-item targets when M6 builds the beat-anchor affordances.
- **Decision:** As above. _(Supersedes both PRD §6.4's original accent-outline selection — §6.4 updated — and the initial M5 "grayscale fill only / faint gray hover" call, replaced after reviewing MuseScore's model.)_

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

Download is the _only_ orange primary button (PRD §6.1/§6.2). Defines the primary‑button style; Print sits beside it as secondary.

- **Decision:** _TBD_

### A7. Overlay drag interaction — _first needed: M7_ 🔲

Drag‑handle affordance, snap‑to‑barline indicator while dragging, drop feedback. Re‑projected from logical anchors on resize (Invariant #4).

- **Decision:** _TBD_

---

## B. Per‑milestone decisions

### M5 — Overlay projector + Selection + bar‑highlight playhead

- ⚑ **B5.1 Selected‑bar treatment** — outline only / tint fill / both; opacity that doesn't obscure notes. ✅
  - **Decision:** **Warm-gray border + light warm-gray fill** (MuseScore-style) — `box-shadow: inset 0 0 0 2px rgba(120,119,116,.5)` + `background rgba(120,119,116,.1)`. Two alphas of one warm gray; translucent so notes stay legible; no accent (see B5.4). _(Revised from the initial "fill only" after seeing MuseScore's border+highlight model.)_
- **B5.2 Bar hover state** — do bars visibly indicate they're clickable on hover? ✅
  - **Decision:** **No idle hover** on bars — and the edit-mode hover rule is **commented off** in `OverlayLayer.css` (kept for easy revisit, per the human's "disable but keep the development"). The hover affordance belongs to individual items (note/chord/section → 100% accent), per A2's item level (M6/M7). _(Revised from the initial faint-gray-hover call.)_ While **playing**, hovering a bar previews it in light orange (`rgba(232,89,12,.08)`) to invite a click-to-seek (see B5.8).
- **B5.3 Deselect gesture** — click empty desk / Esc / click again? ✅
  - **Decision:** Click empty desk **or** Esc. (Bar clicks `stopPropagation`; the `.osmd-scroll` background click clears selection; Esc handled in `App`.)
- ⚑ **B5.4 Playing‑bar vs selected‑bar differentiation** — both want `--accent-tint`; they need distinct treatments so they never look identical. ✅
  - **Decision:** Distinguish by **hue, not shape**: playing = orange wash (`rgba(232,89,12,.16)`), selected = warm-gray border+fill. The accent is reserved for playback (§6.1). When a bar is both, the orange reads on top with the gray border still visible at the edge. _(Chosen by the human over the three shape-based schemes proposed.)_
- **B5.5 Cursor replacement** — does the M2 thin‑line cursor get replaced by the full‑bar highlight, or do both show? (PRD M5 says replace.) ✅
  - **Decision:** **Replace.** The full-bar orange wash is the sole playhead. OSMD's cursor is fully disabled — note that just dropping `cursorsOptions` still leaves OSMD's _default_ cursor (a stray green box), so the `CursorController` is also made a no-op.
- **B5.6 Auto‑scroll** — keep the playing bar in view during playback, here or deferred (post‑MVP P3)? ✅
  - **Decision:** **In M5** (human pulled it forward from P3). Nudge the playing bar into view only when it drifts outside a comfortable band (~15% margins), so it doesn't fight the user or constantly re-center.
- **B5.7 Beat anchors visibility** — built as scaffolding in M5; invisible until M6 or already a faint affordance? ✅
  - **Decision:** **Invisible scaffolding.** `computeBeatAnchors` exists (linear time-sig division) but nothing renders on the anchors until M6; M6 may refine their x from actual note graphics.
- **B5.8 Click-a-bar-to-seek (while playing)** — clicking a bar during playback. ✅
  - **Decision:** A bar click always **selects** it; while **playing** it also **seeks the playhead to that bar and continues** (`Player.seekToMeasure`, off the schedule's `measureStartQuarters`). Pairs with the light-orange playing-mode hover (B5.2).

### M6 — Chords (dropdown)

**Interaction model (from the human's reference mockups, 2026-06-07):** editing is **figure-level**, not bar-level. Two entry points:

1. **Add** — select a **slash/figure** → a **＋ button** appears above it → opens the chord-editor popover (anchored under the staff) to add a chord at that beat. (Mockup: a selected slash with a small accent square above it; popover with a root display, a symbol text field showing e.g. `C7`, an **Add** button, a collapse chevron, and a close ×; a live preview of the symbol renders above the staff.)
2. **Edit** — **click an existing chord** → the same popover opens **pre-filled**, with **Update** instead of Add. (Mockup: the clicked chord turns accent — e.g. `Em` in blue — and the popover shows `Em` with an **Update** button.)

These build on M5's invisible beat-anchor scaffold + bar selection, and on the item-level hover (B6.12).

- ⚑ **B6.1 Chord rendering ownership** — keep OSMD's drawn symbols + invisible click target, **or** hide OSMD text and render our own HTML pills. Architectural; shapes everything below. The mockups recolor the existing symbol to accent on select, which leans toward "keep OSMD's text + a click/hover target over it" rather than fully re-rendering pills. 🔲
  - **Decision:** _TBD_
- **B6.2 Beat‑anchor affordance** — the "ghost target above the staff that brightens on hover" (PRD §6.3): shape (＋ / dot / pill outline), size, and **density** (per beat / per slash / per division). Per the mockup, the **＋ appears on a _selected_ slash** (not on every beat at rest), which keeps the staff clean. 🔲
  - **Decision:** _TBD_
- ⚑ **B6.3 Chord‑editor popover layout** — Root + Quality + optional Bass + live preview + Apply/Remove; columns vs stacked; compactness. The mockup shows a compact horizontal bar: **[root display] [symbol text field] [Add/Update] [collapse ▾] [close ×]**, anchored beneath the staff with a pointer, plus the live symbol drawn above the staff. (The text field accepts typed symbols like `C7`/`Em`; the collapse chevron likely reveals the fuller root/quality/bass picker — B6.4–B6.7.) 🔲
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
- **B6.9 Existing‑chord chips — click to edit** — **clicking a chord opens the editor pre‑filled** (Update), with the chord recolored to accent while active (mockup). Styling, how the hit-target sits over the beat. 🔲
  - **Decision:** _TBD_
- **B6.10 Keyboard map** — Enter = apply/Update, Esc = cancel/close, type‑ahead in the symbol field. 🔲
  - **Decision:** _TBD_
- **B6.11 Respell chord root** — right‑click → "Respell" (first context‑menu use, A3). 🔲
  - **Decision:** _TBD_
- **B6.12 Item-level hover/highlight + chord audition** _(carried over from the M5 hover/selection pass; needs per-item targets that land here)_ 🔲
  - **Figure hover (edit mode) → 100% accent** on just that item (note/slash/chord) — the A2 item level; selecting a bar **highlights all items inside it**. This is the edit-mode hover deliberately left out of M5.
  - **Chord audition (play):** an earlier idea was "click a chord to play it," but the mockups make **click = edit**. So chord playback moves _into_ the editor — e.g. a small **preview/play** control in the popover, or sounding the chord as feedback when Add/Update is applied — rather than a bare click. (The plumbing is trivial: `voicingFromHarmony` + `Synth.playChord`, the same path M2 uses.) Decide the exact audition gesture here.
  - **Decision:** _TBD_

### M7 — Slashes, Sections, Annotations, Download + Print

- **B7.1 Slashes control** — toolbar toggle acting on the _selected_ bar (depends on M5 selection); enabled/disabled logic + on/off state reflecting the current bar. 🔲
  - **Decision:** _TBD_
- **B7.2 Section pills** — `＋Section` button placement; preset label menu (Intro/Verse/Chorus/Bridge/Solo/Outro/custom) + custom entry; boxed/enclosure styling (rehearsal convention); rename UI; remove affordance. 🔲
  - **Decision:** _TBD_
- **B7.3 Annotations** — `＋Note` button; plain sticky styling (no box, contrasting sections); edit‑text + remove; how it differs visually from a section. 🔲
  - **Decision:** _TBD_
- **B7.4 Note respell** — right‑click note → "Respell" (context menu, A3). 🔲
  - **Decision:** _TBD_
- ⚑ **B7.5 Download** — placement (topbar right), the single orange primary (A6), downloaded filename convention, success toast (A4). 🔲
  - **Decision:** _TBD_
- **B7.6 Print** — placement beside Download (secondary); **what prints** (`@media print`, score only — hide topbar/toolbar/transport/cursor/overlays); does the **title/subline header** print? (the _embedded_ subline is post‑MVP P4). 🔲
  - **Decision:** _TBD_
- **B7.7 Section/annotation item hover → accent** _(carried over from the M5 hover/selection pass)_ — hovering a section pill or annotation highlights it in **100% accent** (A2 item level); they become hoverable items once they're HTML overlays here. 🔲
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

- **2026-06-07 — M5 visual language (A2, B5.1, B5.4, B5.5)** — Selection and playback are told apart by **hue** (accent reserved for playback per §6.1), never by shape. The full-bar orange wash **replaces** M2's thin-line cursor (OSMD's default cursor disabled via a no-op `CursorController`). Folded into PRD §6.4. _Rationale:_ proposed three shape-based schemes; the human chose the simpler hue split — orange = playing, gray = selecting.
- **2026-06-07 — M5 selection revised to MuseScore model (A2, B5.1, B5.2, B5.8)** — After the first build, the human refined it against MuseScore: selected bar = **warm-gray border + light warm-gray fill** (two alphas of one warm gray), **no idle bar hover**, and **click-a-bar-to-seek while playing** (with a light-orange playing-mode hover preview). Item-level hover/highlight (notes/chords/sections → 100% accent; highlight all items in a selected bar) and **chord click-to-play** were defined as the model but **deferred to M6/M7** (need per-item projection) — recorded in B6.12 / B7.7.
- **2026-06-07 — M5 hover / deselect (B5.2, B5.3)** — Idle bars show no hover; deselect via Esc or a click on the empty desk.
- **2026-06-07 — Auto-scroll (B5.6)** — Pulled into M5 from post-MVP P3; nudges the playing bar into view only when it leaves a comfortable band.
- **2026-06-07 — Beat anchors (B5.7)** — Computed as invisible scaffolding in M5; nothing rendered on them until M6.
- **2026-06-07 — Edit-mode bar hover disabled; editing is figure-level (B5.2, B6)** — Hovering a whole bar in edit mode is irrelevant, so the edit-mode bar hover is **commented off** in code (kept for easy revisit); the playing-mode hover stays. Real editing is **per-figure**: select a slash → **＋** add chord; click a chord → **edit** (Update). Captured from the human's mockups into B6 (model note, B6.2/B6.3/B6.9/B6.12). A briefly-considered **chord click-to-play was pulled into M5 then reversed** — since click = edit, chord audition belongs inside the M6 editor (B6.12). **M5 stays bar-level only.**
