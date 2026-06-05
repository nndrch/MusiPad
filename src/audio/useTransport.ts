import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { buildSchedule } from './schedule';
import { Synth } from './synth';
import { Player, type CursorController, type TransportState } from './player';

/**
 * Bridges the framework-agnostic `Player`/`Synth` (PRD §7.1, M2) to React.
 * Owns their lifecycle, rebuilds the schedule from the DOM, and re-wires OSMD's
 * cursor as the visual playhead whenever the score (re)renders.
 *
 * The schedule is derived from `doc` (Invariant #1: the DOM is the source of
 * truth); `renderTick` bumps after every OSMD render so we relink the cursor to
 * the freshly-drawn graphics.
 */
export interface TransportControls {
  state: TransportState;
  toggle: () => void;
  seek: (sec: number) => void;
  setMetronome: (enabled: boolean) => void;
}

const INITIAL_STATE: TransportState = {
  positionSec: 0,
  durationSec: 0,
  isPlaying: false,
  metronome: false,
};

export function useTransport(
  doc: Document | null,
  osmd: OpenSheetMusicDisplay | null,
  renderTick: number,
): TransportControls {
  const [state, setState] = useState<TransportState>(INITIAL_STATE);
  const synthRef = useRef<Synth | null>(null);
  const playerRef = useRef<Player | null>(null);

  // Create the audio engine once, tear it down on unmount.
  useEffect(() => {
    const synth = new Synth();
    const player = new Player(synth, setState);
    synthRef.current = synth;
    playerRef.current = player;
    return () => {
      player.dispose();
      synth.dispose();
      synthRef.current = null;
      playerRef.current = null;
    };
  }, []);

  // (Re)load the schedule + cursor whenever the score or its rendering changes.
  // Note (M4): a command edit (Key/Transpose/Tempo) bumps `renderTick`, so an
  // edit made *during* playback reloads here — `Player.load` stops playback and
  // resets the playhead to the top. Acceptable for M4 (the new tempo is audible
  // on the next play); preserving the play position across a schedule rebuild is
  // a transport refinement deferred to M5 (post-MVP).
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !doc || !osmd) return;
    player.load(buildSchedule(doc), makeCursorController(osmd));
  }, [doc, osmd, renderTick]);

  const toggle = useCallback(() => playerRef.current?.toggle(), []);
  const seek = useCallback((sec: number) => playerRef.current?.seek(sec), []);
  const setMetronome = useCallback(
    (enabled: boolean) => playerRef.current?.setMetronome(enabled),
    [],
  );

  return { state, toggle, seek, setMetronome };
}

/** Adapt OSMD's cursor to the engine's `CursorController` (PRD §9 M2 playhead). */
function makeCursorController(osmd: OpenSheetMusicDisplay): CursorController {
  return {
    // Reposition only — visibility is controlled separately so the playhead
    // stays hidden in the idle state and only appears once playback/scrub starts.
    reset() {
      osmd.cursor?.reset();
    },
    next() {
      osmd.cursor?.next();
    },
    show() {
      osmd.cursor?.show();
    },
    hide() {
      osmd.cursor?.hide();
    },
  };
}
