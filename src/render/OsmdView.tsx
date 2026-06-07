import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ScoreInfo } from '../model/scoreInfo';
import { OverlayLayer } from '../overlay/OverlayLayer';
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
  /** Selected bar (ephemeral view state, M5); null when nothing is selected. */
  selectedMeasure: number | null;
  /** Select a bar, or deselect with null (click empty desk). */
  onSelectMeasure: (measureIndex: number | null) => void;
  /** Seek the playhead to a bar (used while playing — click-to-seek, M5). */
  onSeekMeasure: (measureIndex: number) => void;
  /** Bar the playhead is in (-1 if none) — drives the playing highlight (M5). */
  playingMeasure: number;
  isPlaying: boolean;
}

/**
 * The score canvas. OSMD renders the DOM once at a fixed `NATURAL_WIDTH`; we
 * then scale that whole page proportionally to fit the viewport width — like
 * MuseScore's page view — so resizing zooms instead of re-breaking lines. An
 * HTML overlay (M5) sits inside the scaled layer for selection + the playing
 * highlight, so it rides the same transform.
 */
export function OsmdView({
  doc,
  info,
  onRendered,
  revision,
  selectedMeasure,
  onSelectMeasure,
  onSeekMeasure,
  playingMeasure,
  isPlaying,
}: OsmdViewProps) {
  // Bump a render signal after each successful OSMD render so the overlay
  // re-projects its measure boxes; also forward the instance to App (M2).
  const [renderSignal, setRenderSignal] = useState(0);
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });
  const handleRendered = useCallback((instance: OpenSheetMusicDisplay) => {
    onRenderedRef.current?.(instance);
    setRenderSignal((s) => s + 1);
  }, []);

  const { containerRef, status, error, osmdRef } = useOsmd(
    doc,
    handleRendered,
    revision,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
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
    // Clicking the desk (anywhere not a bar) clears the selection (B5.3).
    <div
      className="osmd-scroll"
      ref={scrollRef}
      onClick={() => onSelectMeasure(null)}
    >
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
            <OverlayLayer
              osmdRef={osmdRef}
              hostRef={containerRef}
              renderSignal={renderSignal}
              selectedMeasure={selectedMeasure}
              onSelectMeasure={onSelectMeasure}
              onSeekMeasure={onSeekMeasure}
              playingMeasure={playingMeasure}
              isPlaying={isPlaying}
              scrollRef={scrollRef}
            />
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
