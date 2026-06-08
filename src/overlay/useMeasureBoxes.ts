import { useLayoutEffect, useState, type RefObject } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import {
  computeMeasureBoxes,
  computeStaffEntries,
  type MeasureBox,
  type StaffEntryAnchor,
} from './projector';

/** The rendered `<svg>`'s offset box within `.osmd-scale` (unscaled px). */
export interface OverlayFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayProjection {
  boxes: MeasureBox[];
  /** One anchor per note onset — chord pills / ＋ / slash targets ride these (M6). */
  entries: StaffEntryAnchor[];
  /** Where to position the overlay so box coords (svg-relative) map directly. */
  frame: OverlayFrame | null;
}

/**
 * Recomputes the overlay's measure boxes (and scaffold beat anchors) from
 * OSMD's graphical model after every render (M5). `renderSignal` bumps once per
 * successful OSMD render; the boxes are in unscaled score pixels, so the shared
 * `.osmd-scale` transform handles resize without recomputation (PRD §7.4).
 *
 * Refs (not values) are passed so this never re-triggers OSMD itself; the
 * layout effect runs synchronously after the DOM updates, when the `<svg>`
 * (used to self-calibrate the pixel scale) is present.
 */
export function useMeasureBoxes(
  osmdRef: RefObject<OpenSheetMusicDisplay | null>,
  hostRef: RefObject<HTMLElement | null>,
  renderSignal: number,
): OverlayProjection {
  const [result, setResult] = useState<OverlayProjection>({
    boxes: [],
    entries: [],
    frame: null,
  });

  useLayoutEffect(() => {
    const osmd = osmdRef.current;
    const host = hostRef.current;
    if (!osmd || !host) {
      setResult({ boxes: [], entries: [], frame: null });
      return;
    }
    const svg = host.querySelector('svg') as SVGElement | null;
    const boxes = computeMeasureBoxes(osmd, svg);
    const entries = computeStaffEntries(osmd, svg);
    // OSMD's coordinate (0,0) is the top-left of the svg, which sits at the
    // host's *content-box* origin (inside its padding). We derive the overlay
    // frame from the host — a real HTMLElement with valid offset/client metrics
    // (svg elements don't expose `offsetLeft` etc.) — plus its padding, so box
    // coords (svg-relative) drop in directly. These are layout values, immune
    // to the CSS scale transform `.osmd-scale` applies to the whole layer.
    const cs = getComputedStyle(host);
    const padL = Number.parseFloat(cs.paddingLeft) || 0;
    const padT = Number.parseFloat(cs.paddingTop) || 0;
    const padR = Number.parseFloat(cs.paddingRight) || 0;
    const padB = Number.parseFloat(cs.paddingBottom) || 0;
    const frame: OverlayFrame = {
      left: host.offsetLeft + host.clientLeft + padL,
      top: host.offsetTop + host.clientTop + padT,
      width: host.clientWidth - padL - padR,
      height: host.clientHeight - padT - padB,
    };
    setResult({ boxes, entries, frame });
    // renderSignal is the trigger; refs are stable and intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderSignal]);

  return result;
}
