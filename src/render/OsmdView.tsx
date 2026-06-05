import { useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ScoreInfo } from '../model/scoreInfo';
import { ScoreHeader } from './ScoreHeader';
import { NATURAL_WIDTH, useOsmd } from './useOsmd';
import './OsmdView.css';

interface OsmdViewProps {
  doc: Document;
  /** Title + Key·Tempo·Feel for the HTML header (M4). */
  info: ScoreInfo;
  /** Fires after each successful render with the OSMD instance (M2 playback). */
  onRendered?: (osmd: OpenSheetMusicDisplay) => void;
  /** Bumps when a command edits the DOM in place — triggers a re-render (M3). */
  revision?: number;
}

/**
 * The score canvas. OSMD renders the DOM once at a fixed `NATURAL_WIDTH`; we
 * then scale that whole page proportionally to fit the viewport width — like
 * MuseScore's page view — so resizing zooms instead of re-breaking lines.
 */
export function OsmdView({ doc, info, onRendered, revision }: OsmdViewProps) {
  const { containerRef, status, error } = useOsmd(doc, onRendered, revision);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  // A4 floor for the sheet: a short chart still reads as a full page.
  const [paperMinHeight, setPaperMinHeight] = useState(0);

  // Scale factor follows the page's available (content-box) width. The rAF defers
  // the state write out of the observer callback so a width→height→scrollbar→width
  // cascade can't trip "ResizeObserver loop completed with undelivered notifications".
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = page.clientWidth;
        setScale(width / NATURAL_WIDTH);
        // A4 is a √2 page: height = width × 297/210.
        setPaperMinHeight((width * 297) / 210);
      });
    });
    ro.observe(page);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // Track the score's natural (unscaled) rendered height.
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setNaturalHeight(host.offsetHeight));
    });
    ro.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [containerRef]);

  return (
    <div className="osmd-scroll">
      {/* One white "paper": the document header (title + subline) sits on the
          same sheet as the score, unscaled, with the zoom-to-fit score below.
          `minHeight` holds A4 proportions so a short chart still looks like a page. */}
      <div className="osmd-paper" style={{ minHeight: paperMinHeight }}>
        <ScoreHeader info={info} />
        <div
          ref={pageRef}
          className="osmd-page"
          style={{ height: naturalHeight * scale }}
        >
          <div
            className="osmd-scale"
            style={{
              width: NATURAL_WIDTH,
              transform: `scale(${scale})`,
            }}
          >
            <div ref={containerRef} className="osmd-host" aria-label="Score" />
          </div>
          {status === 'rendering' && (
            <div className="osmd-status">Rendering score…</div>
          )}
          {status === 'error' && (
            <div className="osmd-status is-error">
              Couldn’t render this score: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
