import { useEffect, useRef, useState } from 'react';
import {
  OpenSheetMusicDisplay,
  type IOSMDOptions,
} from 'opensheetmusicdisplay';
import { feelWordsDirection, isAnnotation } from '../model/directions';
import { applySlashGrid } from '../model/slashGrid';

export type OsmdStatus = 'empty' | 'rendering' | 'ready' | 'error';

interface UseOsmdResult {
  /** Attach to the container div OSMD draws into. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: OsmdStatus;
  error: string | null;
  /** The OSMD instance (view), for later milestones (overlays, playback). */
  osmdRef: React.RefObject<OpenSheetMusicDisplay | null>;
}

/**
 * Fixed layout width OSMD lays the score out at. The page never reflows on
 * resize; instead OsmdView scales this whole layout proportionally to fit the
 * viewport (MuseScore-like zoom-to-width), so line breaks stay put.
 */
export const NATURAL_WIDTH = 1200;

const OSMD_OPTIONS: IOSMDOptions = {
  autoResize: false, // we scale proportionally instead of reflowing (no line breaks change)
  backend: 'svg', // SVG so M5 can overlay an HTML layer on top
  drawingParameters: 'default',
  // The title is rendered as an HTML document header instead (M4 `ScoreHeader`),
  // so it's live-editable and carries the Key · Tempo · Feel subline.
  drawTitle: false,
  // Pipeline output labels the part with a long opaque id (e.g.
  // "Instr. P269f…") which otherwise indents the first system off-center.
  drawPartNames: false,
  // The pipeline writes the library name ("Music21") as the composer; it's not
  // meaningful content for a correction tool.
  drawComposer: false,
  // The movement-title duplicates the work-title, so the subtitle is redundant.
  drawSubtitle: false,
  // Tempo / Key / Feel live in the topbar chips, so the printed ♩=NN metronome
  // mark is redundant on the page (and collided with the feel words). The feel
  // words themselves are stripped in `buildRenderDoc` (no OSMD flag for them).
  drawMetronomeMarks: false,
  // No OSMD cursor in M5: the thin-line playhead (M2) is replaced by the
  // full-bar highlight in the HTML overlay (decision B5.5), driven by the
  // transport's `currentMeasure`. The Player's CursorController calls become
  // harmless no-ops (`osmd.cursor` is undefined without `cursorsOptions`).
};

/**
 * A view-only copy of the score for OSMD to render. The real `doc` stays the
 * single source of truth (Invariant #1) — it keeps every element for export,
 * the topbar chips, and playback. This clone drops the marks we render
 * ourselves (HTML overlays) or surface elsewhere, so OSMD doesn't *also* draw
 * them (a double-render under our overlays):
 *   • **feel/style words** — surfaced as the topbar subline (`scoreInfo`).
 *   • **section rehearsal marks** (M7) — drawn by the section overlay.
 *   • **MusiPad annotation words** (M7, tagged) — drawn by the annotation overlay.
 * We strip exactly those directions from the render clone. Crucially we do NOT
 * strip pre-existing, untagged `<words>` (e.g. "D.C. al Coda", expression text):
 * those aren't MusiPad annotations and OSMD should render them natively
 * (guidelines §80). (The tempo ♩=NN mark is suppressed via `drawMetronomeMarks`
 * instead.) Chords are handled differently — kept and painted transparent —
 * because OSMD reserving their row is what gives the pills space with zero
 * layout shift.
 */
function buildRenderDoc(doc: Document): Document {
  const clone = doc.cloneNode(true) as Document;
  const feel = feelWordsDirection(clone);
  const part = clone.querySelector('part');
  part?.querySelectorAll(':scope > measure > direction').forEach((dir) => {
    const isSection = !!dir.querySelector('direction-type > rehearsal');
    if (isSection || isAnnotation(dir) || dir === feel) dir.remove();
  });
  // M9: flatten every bar to the meter's uniform slash grid, so the chart shows
  // only slashes — the written melody is hidden. Clone-only: the real `doc`
  // keeps its notes for playback/download (Invariant #2). Clef/key glyphs are
  // hidden via EngravingRules below; chords/sections/annotations carry over.
  applySlashGrid(clone, { force: true });
  // M9: the section-start double barline is drawn as our own overlay divider
  // (MarkLayer), derived from section presence — so strip it from the clone;
  // OSMD shouldn't also draw it. The real DOM keeps the <barline> for download.
  clone.querySelectorAll('part > measure > barline').forEach((bar) => {
    if (
      bar.getAttribute('location') === 'left' &&
      bar.querySelector('bar-style')?.textContent?.trim() === 'light-light'
    ) {
      bar.remove();
    }
  });
  return clone;
}

/** Tweaks so chord symbols get their reserved row and lead-sheet line density. */
function applyEngravingRules(osmd: OpenSheetMusicDisplay): void {
  const rules = osmd.EngravingRules;
  // Chords (M6): we render our own HTML pills in the overlay (decision B6.1),
  // so OSMD's drawn glyphs are made invisible — but we keep `RenderChordSymbols`
  // on so OSMD still *reserves* the chord row above the staff and lays the
  // systems out exactly as in M5. That gives our pills their room with zero
  // layout shift. Painting the glyphs transparent (rather than stripping
  // `<harmony>` from the render clone) is what preserves that reserved space.
  // Sections/annotations differ: they ARE stripped from the render clone
  // (`buildRenderDoc`) and drawn purely as HTML overlays, so no OSMD rule is
  // needed for them here.
  (
    rules as unknown as { DefaultColorChordSymbol: string }
  ).DefaultColorChordSymbol = '#00000000';
  // Lead-sheet readability (Berklee §16): ~4 bars per line, not OSMD's dense
  // density-based packing. Explicit XML system/page breaks still take effect.
  rules.RenderXMeasuresPerLineAkaSystem = 4;
  rules.NewSystemAtXMLNewSystemAttribute = true;
  // M7: the section pills and annotations are HTML overlays drawn ABOVE the
  // chord row (they're stripped from this render doc, so OSMD reserves no space
  // for them). Open up the layout so they have room and never crowd the staff:
  //   • spread systems apart so one staff's stacked marks clear the staff above;
  //   • add top-of-page headroom for the first system's marks;
  //   • pad the chord row off the staff (more air between staff and chord).
  // All tunable (OSMD units, ~10px each at base zoom). Defaults in parens.
  rules.MinimumDistanceBetweenSystems = 15; // (7)
  rules.MinSkyBottomDistBetweenSystems = 14; // (5)
  rules.PageTopMargin = 9; // (5)
  rules.ChordSymbolYPadding = 1.2; // (0) — space between staff and chord marker
  // M9: the simplified chord chart shows only bars + a slash grid + chords, not
  // standard notation — so hide the clef and the key-signature glyph. The time
  // signature stays (drawn at each system start); the melody is already removed
  // upstream in `buildRenderDoc` (the slash-grid flatten).
  rules.RenderClefsAtBeginningOfStaffline = false;
  rules.RenderKeySignatures = false;
  // M9: we draw our own minimal rhythm slashes (SlashLayer) — paint OSMD's
  // slash noteheads + stems transparent so only ours show (the same trick the
  // chord glyphs use). Colour doesn't affect layout, so the staff entries the
  // overlay anchors to are unchanged.
  const slashColors = rules as unknown as {
    DefaultColorNotehead: string;
    DefaultColorStem: string;
  };
  slashColors.DefaultColorNotehead = '#00000000';
  slashColors.DefaultColorStem = '#00000000';
}

/**
 * Renders a MusicXML `Document` with OSMD. OSMD is strictly a *view*
 * (PRD Invariant #1): every change to `doc` triggers a fresh load + render
 * from the DOM. There is no second source of truth here.
 *
 * Status is *derived* from which doc last rendered/failed, so the effect only
 * ever calls setState asynchronously (avoids cascading-render churn).
 *
 * `onRendered` fires after each successful render with the OSMD instance, so
 * callers (App) can drive the cursor / build the playback schedule (M2).
 *
 * `revision` re-renders from the same `doc` after an in-place command edit (M3):
 * commands mutate the DOM without changing its identity, so bumping `revision`
 * is how the view learns to redraw.
 */
export function useOsmd(
  doc: Document | null,
  onRendered?: (osmd: OpenSheetMusicDisplay) => void,
  revision = 0,
): UseOsmdResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [renderedDoc, setRenderedDoc] = useState<Document | null>(null);
  const [failure, setFailure] = useState<{
    doc: Document;
    message: string;
  } | null>(null);

  // Keep the latest callback in a ref so its identity never re-triggers render.
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  // Create the OSMD instance once, tied to the container element.
  useEffect(() => {
    if (!containerRef.current) return;
    const osmd = new OpenSheetMusicDisplay(containerRef.current, OSMD_OPTIONS);
    applyEngravingRules(osmd);
    osmdRef.current = osmd;
    return () => {
      osmd.clear();
      osmdRef.current = null;
    };
  }, []);

  // Load + render whenever the document changes — or when `revision` bumps,
  // i.e. a command edited the DOM in place (M3).
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    if (!doc) {
      osmd.clear();
      return;
    }

    let cancelled = false;
    osmd
      .load(buildRenderDoc(doc))
      .then(() => {
        if (cancelled) return;
        osmd.render();
        setRenderedDoc(doc);
        setFailure(null); // a fresh successful render clears any prior error
        onRenderedRef.current?.(osmd);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure({
          doc,
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [doc, revision]);

  const error = failure && failure.doc === doc ? failure.message : null;
  const status: OsmdStatus = !doc
    ? 'empty'
    : error
      ? 'error'
      : renderedDoc === doc
        ? 'ready'
        : 'rendering';

  return { containerRef, status, error, osmdRef };
}
