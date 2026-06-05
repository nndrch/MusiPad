# Spikes log

Findings from the de-risking spikes called for in the PRD (§11). Each entry records what was tested, the result, and the decision it drives.

---

## S1 — OSMD slash rendering (M1, PRD §8 + §11)

**Question:** Does OSMD render `<measure-style>/<slash>` regions (the §8 "preferred" target for the per-bar Slashes feature), or must we use the slash-notehead fallback?

**OSMD version:** `opensheetmusicdisplay@1.9.9`.

**Method:** Source inspection of the shipped bundle (`build/opensheetmusicdisplay.min.js`) plus a valid fixture at [`public/samples/slashes.musicxml`](../public/samples/slashes.musicxml) (a `<measure-style><slash type="start"/></measure-style>` region in measure 2).

**Findings:**

1. **`measure-style/slash` is NOT supported.** When the reader encounters `<measure-style>` it only reads the `<multiple-rest>` child; the `<slash>` child is never parsed. So a slash _region_ is silently ignored — the notes in that bar render as ordinary noteheads.
2. **Per-note `<notehead>slash</notehead>` IS supported.** The note reader maps notehead text `"slash"` → `NoteHeadShape.SLASH`, and VexFlow has a corresponding slash glyph. So per-beat slash noteheads do render.

**Decision (locked before M7):** Implement the **Slashes** feature via the **slash-notehead fallback** — set `<notehead>slash</notehead>` on each note in the selected bar (durations unchanged) rather than writing `measure/attributes/measure-style/slash`. This renders correctly in OSMD and round-trips in the downloaded MusicXML. Update the §8 mapping accordingly when M7 lands.

**Status:** Resolved.
