import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { buildSchedule } from './schedule';
import { Synth } from './synth';
import { Player, type CursorController, type TransportState } from './player';
import { AudioTrack } from './AudioTrack';

/**
 * Bridges the framework-agnostic `Player`/`Synth` (PRD §7.1) to React. Owns
 * their lifecycle, rebuilds the schedule from the DOM, and — from M13 — attaches
 * the loaded **recording** as the transport's clock + sound (the synth then only
 * clicks the metronome and auditions chords).
 *
 * The schedule is derived from `doc` (Invariant #1: the DOM is the source of
 * truth); `renderTick` bumps after every OSMD render. Generated charts carry no
 * `<sound tempo>`, so when a recording is loaded its `.bpm` drives a one-tempo
 * override so bar→time matches the recording's constant grid (PRD §6.7).
 */
export interface TransportControls {
  state: TransportState;
  toggle: () => void;
  seek: (sec: number) => void;
  /** Move the playhead to a measure's start; continues if playing (M5). */
  seekToMeasure: (measureIndex: number) => void;
  setMetronome: (enabled: boolean) => void;
  /** Pause playback (no-op if already paused) — stops at the playhead when the
   *  user starts editing during playback (M13). */
  pause: () => void;
  /** Sound a chord once as editor feedback (M6 audition). */
  previewChord: (pitches: number[]) => void;
  /** Attach the recording to review against (M13): the audio file + its `.bpm`. */
  loadAudio: (file: File, bpm: number) => void;
  /** Whether the view auto-scrolls to keep the playing bar in view (M13 toggle). */
  followPlayhead: boolean;
  /** Toggle the follow-playhead auto-scroll. */
  setFollowPlayhead: (on: boolean) => void;
}

const INITIAL_STATE: TransportState = {
  positionSec: 0,
  durationSec: 0,
  isPlaying: false,
  metronome: false,
  currentMeasure: -1,
  hasAudio: false,
};

export function useTransport(
  doc: Document | null,
  osmd: OpenSheetMusicDisplay | null,
  renderTick: number,
): TransportControls {
  const [state, setState] = useState<TransportState>(INITIAL_STATE);
  const synthRef = useRef<Synth | null>(null);
  const playerRef = useRef<Player | null>(null);

  // M13 audio state: a loaded recording's object-URL drives the <audio> track;
  // its `.bpm` drives the tempo override; the offset is the lead-in nudge.
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBpm, setAudioBpm] = useState<number | null>(null);
  // View preference (M13): auto-scroll to keep the playing bar in view. A toggle
  // so the reviewer can stop the page from moving during playback. Default on.
  const [followPlayhead, setFollowPlayhead] = useState(true);

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

  // (Re)load the schedule whenever the score, its rendering, or the audio tempo
  // changes. A re-render *during* recording playback keeps it going (the review
  // loop = edit chords while listening); see `Player.load`.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !doc || !osmd) return;
    player.load(
      buildSchedule(doc, audioBpm ? { tempoOverrideBpm: audioBpm } : {}),
      makeCursorController(),
    );
  }, [doc, osmd, renderTick, audioBpm]);

  // Attach / detach the recording when its URL changes (M13). `setTrack` disposes
  // any previous track (revoking its object-URL).
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!audioUrl) {
      player.setTrack(null);
      return;
    }
    // The recording's bar 1 aligns with audio t=0 — no lead-in offset (confirmed
    // by ear: a whole-bar offset just starts the metronome/highlight a bar late).
    player.setTrack(new AudioTrack(audioUrl));
  }, [audioUrl]);

  const toggle = useCallback(() => playerRef.current?.toggle(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
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
  const loadAudio = useCallback((file: File, bpm: number) => {
    setAudioBpm(bpm > 0 ? bpm : null);
    setAudioUrl(URL.createObjectURL(file));
  }, []);

  return {
    state,
    toggle,
    seek,
    seekToMeasure,
    setMetronome,
    previewChord,
    pause,
    loadAudio,
    followPlayhead,
    setFollowPlayhead,
  };
}

/**
 * The visual playhead is the full-bar overlay highlight (decision B5.5, driven
 * by `TransportState.currentMeasure`), so OSMD's own cursor is left disabled: a
 * no-op controller means the Player never shows OSMD's default cursor. The
 * engine keeps its `CursorController` seam for the future.
 */
function makeCursorController(): CursorController {
  return {
    reset() {},
    next() {},
    show() {},
    hide() {},
  };
}
