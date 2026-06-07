import { memo, useEffect, useRef, type RefObject } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useMeasureBoxes } from './useMeasureBoxes';
import './OverlayLayer.css';

interface OverlayLayerProps {
  osmdRef: RefObject<OpenSheetMusicDisplay | null>;
  hostRef: RefObject<HTMLElement | null>;
  /** Bumps once per OSMD render so the projection recomputes (M5). */
  renderSignal: number;
  /** Currently selected bar (ephemeral view state — not a Command). */
  selectedMeasure: number | null;
  onSelectMeasure: (measureIndex: number) => void;
  /** Seek the playhead to a bar (used while playing — click-to-seek, M5). */
  onSeekMeasure: (measureIndex: number) => void;
  /** Bar the playhead is in (-1 if none); drives the playing highlight. */
  playingMeasure: number;
  isPlaying: boolean;
  /** The scroll container, for auto-scrolling the playing bar into view. */
  scrollRef: RefObject<HTMLElement | null>;
}

/**
 * The HTML overlay over OSMD's SVG (PRD §7.4, M5). Draws one transparent box
 * per measure. Selection = a grayscale border + light warm-gray fill; the
 * playing bar = an orange wash (hue distinguishes the two; selection is not the
 * accent, which is reserved for playback). Bars show no hover affordance when
 * idle; while playing, hovering a bar shows a light-orange wash and clicking
 * seeks the playhead there (and keeps playing). Mounted inside `.osmd-scale`,
 * so it shares the score's zoom-to-fit transform; box coords come from the
 * projector in unscaled px.
 *
 * Memoized: the transport re-emits state ~40×/s during playback, but this only
 * needs to repaint when the selected/playing measure or play state changes.
 */
export const OverlayLayer = memo(function OverlayLayer({
  osmdRef,
  hostRef,
  renderSignal,
  selectedMeasure,
  onSelectMeasure,
  onSeekMeasure,
  playingMeasure,
  isPlaying,
  scrollRef,
}: OverlayLayerProps) {
  const { boxes, frame } = useMeasureBoxes(osmdRef, hostRef, renderSignal);
  const layerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the playing bar into view (M5 — promoted from post-MVP P3).
  // Only nudges when the bar has drifted outside a comfortable band, so it
  // doesn't constantly re-center or fight the user mid-song.
  useEffect(() => {
    if (!isPlaying || playingMeasure < 0) return;
    const layer = layerRef.current;
    const scroll = scrollRef.current;
    if (!layer || !scroll) return;
    const bar = layer.querySelector<HTMLElement>(
      `[data-measure="${playingMeasure}"]`,
    );
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const viewRect = scroll.getBoundingClientRect();
    const margin = viewRect.height * 0.15;
    const above = barRect.top < viewRect.top + margin;
    const below = barRect.bottom > viewRect.bottom - margin;
    if (above || below) {
      bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [playingMeasure, isPlaying, scrollRef]);

  if (!frame || boxes.length === 0) return null;

  return (
    <div
      ref={layerRef}
      className={`overlay-layer${isPlaying ? ' is-playing-mode' : ''}`}
      style={{
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }}
    >
      {boxes.map((box) => {
        const classes = ['overlay-bar'];
        if (box.measureIndex === selectedMeasure) classes.push('is-selected');
        if (isPlaying && box.measureIndex === playingMeasure)
          classes.push('is-playing');
        return (
          <div
            key={box.measureIndex}
            data-measure={box.measureIndex}
            className={classes.join(' ')}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
            onClick={(e) => {
              // Don't let the click bubble to the desk's deselect handler.
              e.stopPropagation();
              onSelectMeasure(box.measureIndex);
              // While playing, a click also moves the playhead here (B5/B).
              if (isPlaying) onSeekMeasure(box.measureIndex);
            }}
          />
        );
      })}
    </div>
  );
});
