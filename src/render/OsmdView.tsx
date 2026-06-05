import { useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { NATURAL_WIDTH, useOsmd } from './useOsmd';
import './OsmdView.css';

interface OsmdViewProps {
  doc: Document;
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
export function OsmdView({ doc, onRendered, revision }: OsmdViewProps) {
  const { containerRef, status, error } = useOsmd(doc, onRendered, revision);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);

  // Scale factor follows the page's available (content-box) width.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const ro = new ResizeObserver(() => {
      setScale(page.clientWidth / NATURAL_WIDTH);
    });
    ro.observe(page);
    return () => ro.disconnect();
  }, []);

  // Track the score's natural (unscaled) rendered height.
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => setNaturalHeight(host.offsetHeight));
    ro.observe(host);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div className="osmd-scroll">
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
  );
}
