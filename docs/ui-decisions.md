# UI decisions — scoping worksheet

Open UI/UX decisions for the remaining milestones (M5–M9) and the post‑MVP backlog, so they can be defined deliberately rather than improvised during the build. This complements the **UI/UX spec** in [`musicxml-editor-prd.md`](./musicxml-editor-prd.md) §6 (which sets the design language and the intended interactions) and the status view in [`roadmap.md`](./roadmap.md).

**How to use this doc**

- Each item has a one‑line **Decision:** to fill in. Mark status: 🔲 open · 🟡 leaning · ✅ decided.
- When an item is decided, write the decision here and (if it refines the spec) fold it into the PRD §6 / [`musicxml-guidelines.md`](./musicxml-guidelines.md) so the spec stays the source of truth.
- Ground rules that constrain every decision (PRD §6.1): calm, content‑first, **grayscale + a single orange accent** used sparingly (active/selected/primary/playback only); **borders over shadows** (shadows only on popovers/dropdowns); thin lucide line‑icons; no gradients/heavy fills.
- Anything edit‑related must still obey the Core Invariants (PRD §4): the DOM is the source of truth, every edit is an undoable `Command`, overlays anchor to logical `{measure, beat}` positions (not pixels).

---

## 0. Settle these first (they unblock the most)

Resolving these early de‑risks the rest, because the later items inherit from them.

1. ✅ **Chord rendering ownership** (M6) — **resolved**: render our **own HTML pills** (OSMD's drawn glyphs suppressed). → see B6.1.
2. ✅ **Selection + playing‑bar visual language** (M5) — **resolved**: selection = grayscale, playing = orange (distinguished by hue). Reused by chords/sections/annotations later. → see A2, B5.1, B5.4.
3. ✅ **Popover spec** (M6) — **resolved** (M6a): screen-space body portal, anchored under the item, `--shadow-pop`, Esc / click-outside dismiss. → see A1.
4. ✅ **Default chord‑symbol house style** (M6) — **resolved**: normalize to Berklee on edit (mi / Maj7 / ° / ø / + / sus / `C/E`). → see B6.8.
5. ⚑ **Primary button + toast** (M7) — the app's first "loud" moments (Download). → see A.

---

## A. Cross‑cutting UI primitives (design once, reuse everywhere)

Each is _first needed_ at the milestone noted — define it before that point.

### A1. Popover / dropdown — _first needed: M6_ ✅

Anchoring/positioning over the scaled SVG sheet, `--shadow-pop`, max size, dismiss (click‑outside / Esc), focus management.

- **Decision:** Built with the M6a chord editor ([`overlay/ChordEditor.tsx`](../src/overlay/ChordEditor.tsx)). Rendered in a **body portal at `position: fixed`** (screen space) so the score's zoom-to-fit `transform: scale()` doesn't shrink the controls or smear the shadow; anchored **beneath** the clicked item via its `getBoundingClientRect()`, centered and clamped to the viewport. Surface: `--bg` + `1px solid --border-strong` + `--shadow-pop` (the one place shadows are allowed, §6.1). Dismiss on **Esc** or **pointerdown outside** (chord UI is tagged `data-chord-ui` so its own clicks don't self-dismiss); the field autofocuses (and selects existing text on edit). Reused by every future panel.

### A2. Selection visual language — _first needed: M5_ ✅

Two-level model (MuseScore-style), refined during the M5 build:

- **Bar level (M5):** selecting a bar draws a **warm-gray border + a light warm-gray fill** — two alphas of one warm gray (`rgba(120,119,116, .5)` border / `.1` fill), **never** the accent (reserved for playback). Bars show **no** idle hover affordance; the hover cue belongs to individual items. The playing bar is an **orange** wash (`rgba(232,89,12,.16)`); hue, not shape, separates selection from playback. Fills are translucent so notes stay legible.
- **Item level (M6/M7):** hovering an individual **item** (note, chord, or section/annotation) highlights **just that item in 100% accent**; selecting a bar also **highlights all items inside it**. Needs per-item projection that arrives with M6 (chords interactive) and M7 (sections/annotations exist) — see B6/B7. Notes get per-item targets when M6 builds the beat-anchor affordances.
- **Decision:** As above. _(Supersedes both PRD §6.4's original accent-outline selection — §6.4 updated — and the initial M5 "grayscale fill only / faint gray hover" call, replaced after reviewing MuseScore's model.)_

### A3. Context menu (right‑click) — _first needed: M7_ 🔲

Used for "Respell" (note M7) and possibly section/annotation remove. Trigger, look, item style, keyboard.

- **Decision:** _TBD — now **first needed in M7** (note respell, B7.4)._ It was slated for M6b chord-root respell, but M6b was **dropped from the MVP** (2026-06-08) — see the decision log; chord respell never shipped, so the context-menu primitive is unbuilt until M7.

### A4. Toast — _first needed: M7_ 🔲

Quiet, bottom‑left (PRD §6.4). Position, duration, stacking, dismiss, success vs error variants. Used for Download + parse errors; polished in M9.

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

**Interaction model (mockups 2026-06-07, refined live 2026-06-08):** editing is **figure-level**, and **chord editing is kept separate from note editing** (the latter — slash toggle / note respell — is M7). Two hover-driven entry points:

1. **Add** — **hover an empty slash** (no chord above it) → a **＋** appears above the note → click it to open the editor and **add** a chord at that beat. (No select-first step; the ＋ is purely hover-revealed, so the staff stays clean and note-selection isn't conflated with chord-add.)
2. **Edit** — **hover an existing chord** → the pill **highlights** (accent); **click** it → the editor opens **pre-filled** with **Update** + **Remove**.

These build on M5's beat-anchor scaffold (now refined to real note graphics — B6.1).

**Delivery (planned 2026-06-07 as two PRs; shipped as one):** **M6a (shipped, [PR #9](https://github.com/nndrch/MusiPad/pull/9)):** own HTML pills + accurate positioning, the **editable-combobox** editor (type or pick from a **dropdown** of the root's qualities → Berklee normalize → audition), add / edit / remove, all undoable — satisfies the PRD §9 M6 AC. **M6b (the structured root/quality/bass picker + enharmonic toggle + respell) was prototyped then DROPPED from the MVP (2026-06-08)** — the human kept the simple dropdown; see the decision log + post-MVP **P8**. Items below are tagged accordingly.

- ✅ **B6.1 Chord rendering ownership** _(M6a)_ — **Decision:** render our **own HTML pills** ([`overlay/ChordLayer.tsx`](../src/overlay/ChordLayer.tsx)), not OSMD's text, **styled to be indistinguishable from OSMD's engraving** (Times New Roman, normal weight, `ChordSymbolTextHeight`≈20px in score space, chart ink — the pill rides `.osmd-scale` so it scales with the score). OSMD's `RenderChordSymbols` stays **on** so it still _reserves_ the chord row and lays systems out exactly as in M5 (zero layout shift, rehearsal-mark spacing intact), but its glyphs are painted transparent via `EngravingRules.DefaultColorChordSymbol = '#00000000'` ([`render/useOsmd.ts`](../src/render/useOsmd.ts)). The pill sits in that reserved row at a **uniform per-system chord-row Y** (the highest measure-box top on the line — no upward lift, which had collided with the rehearsal mark; uniform so a chord-less bar's ＋ aligns with the line's pills, since OSMD only reserves the row above chord-bearing bars), anchored over the slash each `<harmony>` attaches to by **graphical staff-entry x** (`overlay/projector.computeStaffEntries`) — accurate across bar 1's clef/key/time indent and OSMD's non-linear spacing. Accidentals (♯/♭) render as a smaller raised glyph so the symbol reads as one unit.
- ✅ **B6.2 Beat‑anchor affordance** _(M6a)_ — **Decision:** a per-empty-slash invisible **hover zone** over the note (`.chord-slot`, ~22px) that **reveals a ＋ on hover** (no persistent selection, no fill over the note — chord-add stays separate from note-edit). The ＋ sits in the chord row above the note; click → add. A slash that already has a chord shows no zone — it's edited via its pill (B6.9). Density = **per sounding note**, matching `commands/chord.ts` note addressing. _(Revised 2026-06-08 from the earlier select-then-＋ with an accent column, which conflated note selection with chord-add and hid the note.)_
- ✅ **B6.3 Chord‑editor popover layout** _(M6a)_ — **Decision:** an **editable combobox** (the human's "editable dropdown"), a vertical stack anchored beneath the item: **header + ×**, one **wide editable field** + **▾** toggle, a **scrollable list** of the current root's qualities (the current chord **checked**), and an action row **[▷ Hear] [＋ Add / ✓ Update] [🗑 remove]**. Built as `.chord-editor` (A1). _(Revised 2026-06-08 from the compact horizontal bar with a separate live-preview chip — that duplicated the value and the field was too short; the combobox is one control.)_
- ✅ **B6.4 Root/quality picker pattern** _(M6a)_ — **Decision:** an **editable combobox** — **type** any symbol (parsed by [`model/chordSymbol.parseChordSymbol`](../src/model/chordSymbol.ts): `Em7`, `F#m7b5`, `BbMaj7`, `C/E`, `N.C.`, unicode ♯♭Δ°ø–) **or pick** from the **dropdown** of the current root's qualities (type filters the list; ↑/↓ + Enter, or click, commits + auditions). _This is the shipped editor._ A fuller **structured note-button grid / bass picker** was prototyped (M6b) but **dropped from the MVP** (2026-06-08) — see post-MVP **P8**.
- ⊘ **B6.5 Enharmonic toggle** _(was M6b)_ — **Decision:** **dropped from the MVP** (2026-06-08, with the structured picker). The typed field already accepts either spelling (C♯ or D♭). An explicit sharp/flat toggle / respell is parked in post-MVP **P8**.
- ⊘ **B6.6 Quality list & grouping** _(was M6b)_ — **Decision:** **dropped from the MVP** (2026-06-08). The shipped editor is the flat **dropdown** of the root's qualities (B6.4); a grouped button grid over the full `kind-value` enum is parked in post-MVP **P8**.
- ⊘ **B6.7 Bass / slash picker** _(was M6b)_ — **Decision:** **dropped from the MVP** (2026-06-08). Slash chords are still fully supported by **typing** `/E` in the field (the parser handles it); a dedicated bass picker is parked in post-MVP **P8**.
- ✅ **B6.8 Default chord‑symbol house style** _(M6a)_ — **Decision:** **normalize to the Berklee house style** on every display/edit (one fixed style; user-selectable styles stay post-MVP P2). Map (`KIND_QUALITY_LABEL` in [`model/chordSymbol`](../src/model/chordSymbol.ts)): minor=`mi`, major-seventh=`Maj7`, minor-seventh=`mi7`, half-diminished=`ø7`, diminished=`°`, diminished-seventh=`°7`, augmented=`+`, sus=`sus2`/`sus4`, sixths=`6`/`mi6`, slash=`C/E`, no-chord=`N.C.`; a plain major is the bare root. We **display** every chord through this formatter (consistent chart) and **write** the quality label to `kind/@text` on edit — but only on an explicit edit, so untouched chords keep their source `@text` on export (Invariant #2).
- ✅ **B6.9 Existing‑chord chips — click to edit** _(M6a)_ — **Decision:** **hovering a pill highlights it** (recolors to **accent**); **clicking** opens the editor pre‑filled with **Update** + **Remove** (the pill stays accent while its editor is open). The pill is centered over its beat, in the chord row.
- ✅ **B6.10 Keyboard map** _(M6a)_ — **Decision:** in the combobox: **↑/↓** move the highlight, **Enter** = apply (the highlighted option, else the typed value, when it parses), **Esc** = close. Add/Update is disabled while the field can't be parsed.
- ⊘ **B6.11 Respell chord root** _(was M6b)_ — **Decision:** **dropped from the MVP** (2026-06-08, with the structured picker). Enharmonic spelling is still reachable by **typing** the desired root (C♯ vs D♭). A respell affordance (in-editor or right-click) is parked in post-MVP **P8**; note respell still arrives in M7 (B7.4) and will build the A3 context menu then.
- 🟡 **B6.12 Item-level hover/highlight + chord audition** _(carried over from the M5 hover/selection pass)_
  - **Figure hover (edit mode) → accent** on just that item — **done for chords in M6a** (`.chord-pill` recolors to accent); **empty notes** reveal the ＋ on hover instead of a highlight (chord-add ≠ note-select). Note-level highlight and "selecting a bar highlights all items inside it" extend in M7 (sections/annotations + slash toggle).
  - **Chord audition (play):** **resolved** — click = edit (not play), so audition lives **in the editor**: a **▷ Hear** button auditions the current chord, and **applying Add/Update / clicking a list option auto-auditions** the result. Same voicing path as playback (`voicingFromSpec` → `Player.previewChord` → `Synth.playChord`).
  - **Decision:** As above (M6a); section/annotation item hover is B7.7 (M7).

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

### M8 — Meter / time-signature editing

Promoted from post-MVP **P7** in the M6 re-weigh (2026-06-08); its own milestone after M7. UI decisions to settle when M8 is scoped.

- **B8.1 Time-signature affordance** — how the staff `4/4` is hover/click-targeted (reuse the M6 staff-entry/measure-box projection); popover trigger + placement. 🔲
  - **Decision:** _TBD_
- **B8.2 Meter popover shape** — beats / beat-type input (steppers vs dropdowns vs text); how `senza-misura` and the common/cut-time `@symbol` are surfaced. 🔲
  - **Decision:** _TBD_

### M9 — Polish

- **B9.1 Keyboard shortcut map** — beyond ⌘Z/⌘⇧Z: space = play/pause? Delete = remove selected? Esc conventions. 🔲
  - **Decision:** _TBD_
- **B9.2 Empty / error state polish** — dropzone, parse error, render error. 🔲
  - **Decision:** _TBD_
- **B9.3 Hover/active audit** — consistency pass against §6.1. 🔲
  - **Decision:** _TBD_
- **B9.4 Toast polish** — finalize the system started in M7 (A4). 🔲
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

- **2026-06-08 — M6b structured picker + respell DROPPED from the MVP (B6.4/5/6/7/11, A3)** — The planned M6b builder (root letter+accidental selector, grouped quality buttons, collapsible `/ bass`, in-editor enharmonic **respell**) was implemented and verified (24/24 headless) on `feat/m6b-chord-picker`, then **rejected on review**: _"The complexity introduced does not make sense to an MVP… keep it simple as a dropdown with a list of chords."_ The work was **discarded uncommitted** (never merged); the editor stays the M6a **editable combobox** (field + dropdown of the root's qualities). B6.5/6.6/6.7/6.11 are marked **⊘ dropped**; the ideas are parked in post-MVP **P8**. **Consequence:** M6 is **complete on the dropdown** (PRD §9 M6 AC already met by M6a), and A3's right-click context-menu primitive is now **first needed in M7** (note respell, B7.4). _Rationale:_ the typed field already covers every spelling/quality/slash a user needs; the structured grid added surface area and maintenance without expanding what the MVP can express.
- **2026-06-07 — M5 visual language (A2, B5.1, B5.4, B5.5)** — Selection and playback are told apart by **hue** (accent reserved for playback per §6.1), never by shape. The full-bar orange wash **replaces** M2's thin-line cursor (OSMD's default cursor disabled via a no-op `CursorController`). Folded into PRD §6.4. _Rationale:_ proposed three shape-based schemes; the human chose the simpler hue split — orange = playing, gray = selecting.
- **2026-06-07 — M5 selection revised to MuseScore model (A2, B5.1, B5.2, B5.8)** — After the first build, the human refined it against MuseScore: selected bar = **warm-gray border + light warm-gray fill** (two alphas of one warm gray), **no idle bar hover**, and **click-a-bar-to-seek while playing** (with a light-orange playing-mode hover preview). Item-level hover/highlight (notes/chords/sections → 100% accent; highlight all items in a selected bar) and **chord click-to-play** were defined as the model but **deferred to M6/M7** (need per-item projection) — recorded in B6.12 / B7.7.
- **2026-06-07 — M5 hover / deselect (B5.2, B5.3)** — Idle bars show no hover; deselect via Esc or a click on the empty desk.
- **2026-06-07 — Auto-scroll (B5.6)** — Pulled into M5 from post-MVP P3; nudges the playing bar into view only when it leaves a comfortable band.
- **2026-06-07 — Beat anchors (B5.7)** — Computed as invisible scaffolding in M5; nothing rendered on them until M6.
- **2026-06-08 — M6a polish pass #2 after live review (B6.1/2, B5.8, §6.1)** — From real-chart screenshots: (1) **＋ in a chord-less bar now aligns with the line's pills** — pills/＋ use a **uniform per-system chord-row Y** (the highest measure-box top on the line) instead of each measure's own box top, because OSMD only reserves the chord row above bars that _have_ a chord (`projector.computeStaffEntries`, pass 1). (2) **Accidental spacing tightened** — ♯/♭/𝄪 render as a smaller, slightly-raised, pulled-in glyph so "E♭mi" reads as one symbol, not "E ♭ mi" (`renderSymbol` + `.chord-pill__acc`). (3) **Selecting a bar cues the play-start** — Play begins from the selected bar; with nothing selected it plays from the top (seek-on-select while paused; extends B5.8). (4) **All-white canvas** — the score desk is now white (no gray surround) with the paper border removed; the content keeps its `max-width` (`OsmdView.css`). Verified headless (main 28/28 + polish 8/8).
- **2026-06-08 — M6a editor/affordance refinements after live review (B6.1/2/3/4/9/10/12, A1)** — From the human's screenshots: (1) **pills now match OSMD's engraving exactly** (Times New Roman / normal / ~20px / chart ink) instead of the app sans-serif; (2) **fixed the pill–rehearsal-mark overlap** — the pill drops the upward lift and sits in OSMD's reserved chord row (measure-box top); (3) **empty-slash hover reveals a ＋** directly (no select-first), with **no accent fill over the note** (it had hidden the slash), and **note-edit is kept separate from chord-edit**; (4) the editor became a **single editable combobox** (type or pick the root's qualities, current checked) — removing the duplicated preview chip and the too-short field. Hovering an existing chord highlights it; clicking edits. All re-verified headless (28/28).
- **2026-06-07 — M6 split into M6a + M6b; M6a built (B6.1/2/3/4/8/9/10/12, A1)** — M6 ships in two PRs. **M6a (built):** **own HTML pills** (OSMD glyphs painted transparent via `DefaultColorChordSymbol`, `RenderChordSymbols` kept on to preserve layout/spacing), positioned by **graphical staff-entry x** (`projector.computeStaffEntries`); the **typed-field editor** (A1 popover — body portal, fixed, Esc/click-outside) with **parse → Berklee normalize → live preview**, **add** (select slash → ＋), **edit/remove** (click pill), all undoable (`commands/chord.ts`, measure-snapshot inverse); **in-editor audition** (▷ Hear + auto-audition on apply, via `voicingFromSpec`/`previewChord`). Satisfies the PRD §9 M6 AC. **M6b (next):** structured root/quality/bass picker + enharmonic toggle (the ▾, disabled in M6a) and right-click **respell** (A3). _Rationale:_ the locked decisions (own pills, Berklee house style, typed+structured editor, respell) were settled first; splitting keeps the first PR focused on the AC-satisfying core.
- **2026-06-07 — Edit-mode bar hover disabled; editing is figure-level (B5.2, B6)** — Hovering a whole bar in edit mode is irrelevant, so the edit-mode bar hover is **commented off** in code (kept for easy revisit); the playing-mode hover stays. Real editing is **per-figure**: select a slash → **＋** add chord; click a chord → **edit** (Update). Captured from the human's mockups into B6 (model note, B6.2/B6.3/B6.9/B6.12). A briefly-considered **chord click-to-play was pulled into M5 then reversed** — since click = edit, chord audition belongs inside the M6 editor (B6.12). **M5 stays bar-level only.**
