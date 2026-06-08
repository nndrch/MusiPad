import { useEffect, useRef, useState } from 'react';
import {
  OpenSheetMusicDisplay,
  type IOSMDOptions,
} from 'opensheetmusicdisplay';

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
 * the topbar chips, and playback. This clone just drops header marks that are
 * now surfaced in the topbar and otherwise clash on the page: the **feel/style
 * words** (the first `words` direction in measure 1, per `scoreInfo`). The
 * tempo (♩=NN) mark is suppressed via `drawMetronomeMarks` instead.
 */
function buildRenderDoc(doc: Document): Document {
  const clone = doc.cloneNode(true) as Document;
  const firstMeasure = clone.querySelector('part > measure');
  const feelWords = firstMeasure?.querySelector(
    'direction direction-type words',
  );
  feelWords?.closest('direction')?.remove();
  return clone;
}

/** Tweaks so loaded section marks and chord symbols don't collide. */
function applyEngravingRules(osmd: OpenSheetMusicDisplay): void {
  const rules = osmd.EngravingRules;
  // Chords (M6): we render our own HTML pills in the overlay (decision B6.1),
  // so OSMD's drawn glyphs are made invisible — but we keep `RenderChordSymbols`
  // on so OSMD still *reserves* the chord row above the staff and lays the
  // systems out exactly as in M5. That gives our pills their room with zero
  // layout shift (and keeps rehearsal-mark spacing intact). Painting the glyphs
  // transparent (rather than stripping `<harmony>` from the render clone) is
  // what preserves that reserved space.
  (
    rules as unknown as { DefaultColorChordSymbol: string }
  ).DefaultColorChordSymbol = '#00000000';
  // Lift rehearsal marks (sections) clearly above the chord-symbol row.
  // In this OSMD version positive offset moves the mark UP; the default (-15)
  // sits on top of the chords, so push it well above them.
  rules.RehearsalMarkYOffsetDefault = 20;
  // Lead-sheet readability (Berklee §16): ~4 bars per line, not OSMD's dense
  // density-based packing. Explicit XML system/page breaks still take effect.
  rules.RenderXMeasuresPerLineAkaSystem = 4;
  rules.NewSystemAtXMLNewSystemAttribute = true;
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
