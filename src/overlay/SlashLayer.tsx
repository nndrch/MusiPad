import { memo, type RefObject } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useMeasureBoxes } from './useMeasureBoxes';
import './SlashLayer.css';

interface SlashLayerProps {
  osmdRef: RefObject<OpenSheetMusicDisplay | null>;
  hostRef: RefObject<HTMLElement | null>;
  /** Bumps once per OSMD render so anchors recompute (M5/M6). */
  renderSignal: number;
}

/** Unscaled px — the size of one rhythm slash stroke (tuned to read like the wireframe). */
const SLASH_W = 11;
const SLASH_H = 17;

/**
 * SlashLayer (M9). Our own **minimal rhythm slashes** — one clean diagonal
 * stroke per beat — drawn over OSMD's SVG, exactly as `ChordLayer` draws our own
 * chord pills. OSMD's slash noteheads + stems are painted transparent (see
 * `useOsmd`), so this is the only visible slash; the result matches the
 * chord-chart wireframe instead of engraved notation.
 *
 * Display-only: no pointer events, no editing. Lives inside `.osmd-scale`, so it
 * rides the zoom transform like the other overlays. Each stroke is centered on
 * the note's projected `(x, y)` — i.e. exactly where OSMD laid the (now
 * invisible) note — so the slash sits on the staff line whatever the staff-line
 * count.
 */
export const SlashLayer = memo(function SlashLayer({
  osmdRef,
  hostRef,
  renderSignal,
}: SlashLayerProps) {
  const { entries, frame } = useMeasureBoxes(osmdRef, hostRef, renderSignal);
  if (!frame || entries.length === 0) return null;

  return (
    <div
      className="slash-layer"
      style={{
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }}
    >
      {entries.map((a) => (
        <svg
          key={`${a.measureIndex}:${a.entryIndex}`}
          className="slash-mark"
          width={SLASH_W}
          height={SLASH_H}
          viewBox={`0 0 ${SLASH_W} ${SLASH_H}`}
          style={{ left: a.x, top: a.y }}
          aria-hidden="true"
        >
          <line
            x1={1}
            y1={SLASH_H - 1}
            x2={SLASH_W - 1}
            y2={1}
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      ))}
    </div>
  );
});
