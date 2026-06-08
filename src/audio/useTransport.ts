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
  /** Move the playhead to a measure's start; continues if playing (M5). */
  seekToMeasure: (measureIndex: number) => void;
  setMetronome: (enabled: boolean) => void;
  /** Sound a chord once as editor feedback (M6 audition). */
  previewChord: (pitches: number[]) => void;
}

const INITIAL_STATE: TransportState = {
  positionSec: 0,
  durationSec: 0,
  isPlaying: false,
  metronome: false,
  currentMeasure: -1,
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
    player.load(buildSchedule(doc), makeCursorController());
  }, [doc, osmd, renderTick]);

  const toggle = useCallback(() => playerRef.current?.toggle(), []);
  const seek = useCallback((sec: number) => playerRef.current?.seek(sec), []);
  const seekToMeasure = useCallback(
    (measureIndex: number) => playerRef.current?.seekToMeasure(measureIndex),
    [],
  );
  const setMetronome = useCallback(
    (enabled: boolean) => playerRef.current?.setMetronome(enabled),
    [],
  );
  const previewChord = useCallback(
    (pitches: number[]) => playerRef.current?.previewChord(pitches),
    [],
  );

  return { state, toggle, seek, seekToMeasure, setMetronome, previewChord };
}

/**
 * The visual playhead in M5 is the full-bar overlay highlight (decision B5.5,
 * driven by `TransportState.currentMeasure`), so OSMD's own cursor is left
 * fully disabled: a no-op controller means the Player never calls `show()` on
 * OSMD's default cursor (which otherwise renders a stray green box over the
 * current note). The engine keeps its `CursorController` seam for the future.
 */
function makeCursorController(): CursorController {
  return {
    reset() {},
    next() {},
    show() {},
    hide() {},
  };
}
