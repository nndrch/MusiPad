import { useEffect, useRef, useState } from 'react';
import {
  CursorType,
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
  drawTitle: true,
  // Pipeline output labels the part with a long opaque id (e.g.
  // "Instr. P269f…") which otherwise indents the first system off-center.
  drawPartNames: false,
  // The pipeline writes the library name ("Music21") as the composer; it's not
  // meaningful content for a correction tool.
  drawComposer: false,
  // The movement-title duplicates the work-title, so the subtitle is redundant.
  drawSubtitle: false,
  // The playback cursor (M2) — a thin orange line at the current onset. Created
  // here so `osmd.cursor` exists after render; the transport drives it.
  // `follow: false` because OsmdView renders into a fixed-width scaled page, so
  // we don't want OSMD's own auto-scroll fighting that transform.
  cursorsOptions: [
    { type: CursorType.ThinLeft, color: '#e8590c', alpha: 0.5, follow: false },
  ],
};

/** Tweaks so loaded section marks and chord symbols don't collide. */
function applyEngravingRules(osmd: OpenSheetMusicDisplay): void {
  const rules = osmd.EngravingRules;
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
 */
export function useOsmd(
  doc: Document | null,
  onRendered?: (osmd: OpenSheetMusicDisplay) => void,
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

  // Load + render whenever the document changes.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    if (!doc) {
      osmd.clear();
      return;
    }

    let cancelled = false;
    osmd
      .load(doc)
      .then(() => {
        if (cancelled) return;
        osmd.render();
        setRenderedDoc(doc);
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
  }, [doc]);

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
