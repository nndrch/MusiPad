import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ScoreInfo } from '../model/scoreInfo';
import type { ChordSpec } from '../model/chordSymbol';
import { OverlayLayer } from '../overlay/OverlayLayer';
import { ChordLayer } from '../overlay/ChordLayer';
import { SlashLayer } from '../overlay/SlashLayer';
import { MarkLayer } from '../overlay/MarkLayer';
import { ScoreHeader } from './ScoreHeader';
import { NATURAL_WIDTH, useOsmd, type ViewMode } from './useOsmd';
import { computePageRects, type PageRect } from '../overlay/projector';
import './OsmdView.css';

/** Stable no-op for the section layer's (unused) pending-edit callback. */
const NO_PENDING_EDIT = () => {};

/** Height (unscaled px) of a later-sheet page-number band in page mode (M10). */
const SHEET_FOOTER_H = 40;

interface OsmdViewProps {
  doc: Document;
  /** Title + Key·Tempo·Feel for the HTML header (M4). */
  info: ScoreInfo;
  /** Continuous (`full`) vs paginated A4 (`page`) layout (M10, PRD §6.6). */
  viewMode: ViewMode;
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
  /** Add or replace a chord at a beat (M6) — undoable command, audition feedback. */
  onSetChord: (
    measureIndex: number,
    entryIndex: number,
    spec: ChordSpec,
  ) => void;
  /** Remove a chord at a beat (M6). */
  onRemoveChord: (measureIndex: number, entryIndex: number) => void;
  /** Move a chord onto another beat, snapping to the nearest slash (M11). */
  onMoveChord: (
    fromMeasure: number,
    fromEntry: number,
    toMeasure: number,
    toEntry: number,
  ) => void;
  /** Audition a chord (the editor's Hear button, M6). */
  onPreviewChord: (spec: ChordSpec) => void;
  /** Section + annotation authoring (M7) — undoable commands. */
  onEditSection: (measureIndex: number, label: string) => void;
  onRemoveSection: (measureIndex: number) => void;
  onMoveSection: (fromIndex: number, toIndex: number) => void;
  onEditAnnotation: (measureIndex: number, text: string) => void;
  onRemoveAnnotation: (measureIndex: number) => void;
  onMoveAnnotation: (fromIndex: number, toIndex: number) => void;
  /** Bar whose annotation editor should auto-open (after ＋Note), or null (M7). */
  pendingAnnotation: number | null;
  /** Called once the pending annotation editor has been opened (M7). */
  onConsumePendingAnnotation: () => void;
  /** Whether the playing bar auto-scrolls into view (M13 toggle). */
  followPlayhead?: boolean;
  /** Report when any overlay editor opens/closes (M13) — App pauses playback
   *  at the playhead when editing starts. */
  onEditingChange?: (open: boolean) => void;
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
  viewMode,
  onRendered,
  revision,
  selectedMeasure,
  onSelectMeasure,
  onSeekMeasure,
  playingMeasure,
  isPlaying,
  onSetChord,
  onRemoveChord,
  onMoveChord,
  onPreviewChord,
  onEditSection,
  onRemoveSection,
  onMoveSection,
  onEditAnnotation,
  onRemoveAnnotation,
  onMoveAnnotation,
  pendingAnnotation,
  onConsumePendingAnnotation,
  followPlayhead,
  onEditingChange,
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
    viewMode,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  // A4 floor for the sheet: a short chart still reads as a full page.
  const [paperMinHeight, setPaperMinHeight] = useState(0);
  // Per-page sheet rectangles (page mode, M10) — for the page-1 header band and
  // later-page page numbers. Recomputed after each OSMD render; the sizes are
  // intrinsic (unscaled), so they don't change on viewport resize.
  const [pageRects, setPageRects] = useState<PageRect[]>([]);
  useEffect(() => {
    setPageRects(
      viewMode === 'page' ? computePageRects(containerRef.current) : [],
    );
  }, [renderSignal, viewMode, containerRef]);
  const isPaged = viewMode === 'page';

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
      className={`osmd-scroll${isPaged ? ' osmd-scroll--page' : ''}`}
      ref={scrollRef}
      onClick={() => onSelectMeasure(null)}
    >
      {/* The "paper". In `full` mode the document header (title + subline) sits
          above the continuous, zoom-to-fit score. In `page` mode (M10) the score
          is a column of A4 sheets and the header is drawn *on* sheet 1 (below),
          so it's omitted here. `minHeight` holds A4 proportions for a short chart. */}
      <div
        className="osmd-paper"
        style={isPaged ? undefined : { minHeight: paperMinHeight }}
      >
        {!isPaged && <ScoreHeader info={info} />}
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
              followPlayhead={followPlayhead}
            />
            <SlashLayer
              osmdRef={osmdRef}
              hostRef={containerRef}
              renderSignal={renderSignal}
            />
            <ChordLayer
              osmdRef={osmdRef}
              hostRef={containerRef}
              renderSignal={renderSignal}
              doc={doc}
              revision={revision ?? 0}
              isPlaying={isPlaying}
              onSetChord={onSetChord}
              onRemoveChord={onRemoveChord}
              onMoveChord={onMoveChord}
              onPreview={onPreviewChord}
              onEditingChange={onEditingChange}
            />
            <MarkLayer
              variant="section"
              osmdRef={osmdRef}
              hostRef={containerRef}
              renderSignal={renderSignal}
              doc={doc}
              revision={revision ?? 0}
              isPlaying={isPlaying}
              selectedMeasure={selectedMeasure}
              onEdit={onEditSection}
              onRemove={onRemoveSection}
              onMove={onMoveSection}
              pendingEdit={null}
              onPendingEditConsumed={NO_PENDING_EDIT}
              onEditingChange={onEditingChange}
            />
            <MarkLayer
              variant="annotation"
              osmdRef={osmdRef}
              hostRef={containerRef}
              renderSignal={renderSignal}
              doc={doc}
              revision={revision ?? 0}
              isPlaying={isPlaying}
              selectedMeasure={selectedMeasure}
              onEdit={onEditAnnotation}
              onRemove={onRemoveAnnotation}
              onMove={onMoveAnnotation}
              pendingEdit={pendingAnnotation}
              onPendingEditConsumed={onConsumePendingAnnotation}
              onEditingChange={onEditingChange}
            />
            {/* Page-layout chrome (M10): the document header on sheet 1, and a
                page number on every later sheet. Absolutely positioned in the
                same unscaled space as the overlays (so they ride the zoom
                transform), placed in each sheet's top / bottom margin where no
                staff is drawn. */}
            {isPaged &&
              pageRects.map((rect) =>
                rect.index === 0 ? (
                  <div
                    key="page-header"
                    className="osmd-sheet-header"
                    style={{ top: rect.top, left: rect.left, width: rect.width }}
                  >
                    <ScoreHeader info={info} />
                  </div>
                ) : (
                  <div
                    key={`page-num-${rect.index}`}
                    className="osmd-sheet-number"
                    style={{
                      top: rect.top + rect.height - SHEET_FOOTER_H,
                      left: rect.left,
                      width: rect.width,
                      height: SHEET_FOOTER_H,
                    }}
                  >
                    Page {rect.index + 1}
                  </div>
                ),
              )}
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
