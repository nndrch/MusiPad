/**
 * Transport engine for chord-chart playback (PRD §9 M2).
 *
 * Timing follows the "two clocks" pattern: a coarse JS timer wakes us ~every
 * 25 ms to schedule any audio falling inside a short look-ahead window, but the
 * audio itself is timestamped against the precise AudioContext clock — so JS
 * timer jitter never reaches what you hear. The visual playhead (OSMD's cursor)
 * is driven off the *same* clock, so picture and sound stay in step.
 *
 * Playback speed is derived entirely from the schedule's tempo map, which comes
 * from the DOM (`sound[@tempo]`, default 120). When M4 edits tempo it rewrites
 * the DOM → the schedule is rebuilt → `load()` is called again: speed updates
 * with no engine change.
 */

import type { PlaybackSchedule } from './schedule';
import { quarterToSeconds } from './schedule';
import type { Synth } from './synth';
import type { AudioTrack } from './AudioTrack';

/**
 * Minimal control surface over the visual playhead. The OSMD adapter (wired in
 * App) implements this over `osmd.cursor`; keeping it abstract means the engine
 * has no OSMD dependency and stays unit-testable.
 */
export interface CursorController {
  /** Reposition to the first onset (visibility unchanged). */
  reset(): void;
  /** Advance one onset. */
  next(): void;
  /** Make the cursor visible. */
  show(): void;
  /** Hide the cursor. */
  hide(): void;
}

export interface TransportState {
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  metronome: boolean;
  /**
   * Index of the measure the playhead is currently inside (the bar-highlight
   * playhead, M5), or -1 when there are no measures. Derived from the same
   * audio clock as everything else, so the highlight stays in step with sound.
   */
  currentMeasure: number;
  /** A recording is loaded (M13) — gates the transport UI (App). */
  hasAudio: boolean;
}

const LOOKAHEAD_SEC = 0.12; // schedule this far ahead of the playhead
const TICK_MS = 25; // how often we wake to schedule + update UI
const PREVIEW_SEC = 1.1; // how long an editor chord audition rings (M6)

export class Player {
  private synth: Synth;
  private onChange: (state: TransportState) => void;

  private schedule: PlaybackSchedule | null = null;
  private cursor: CursorController | null = null;

  // Precomputed second-domain positions (parallel to schedule arrays).
  // Chord regions are what *sounds* (the harmonic rhythm); onsets are the slash
  // grid that only steps the *visual* playhead (the time-feel) — see schedule.ts.
  private chordSecs: number[] = [];
  private chordDurs: number[] = [];
  private chordPitches: number[][] = [];
  private onsetSecs: number[] = [];
  private metroSecs: number[] = [];
  private metroAccents: boolean[] = [];
  // Start time (sec) of each measure — for the bar-highlight playhead (M5).
  private measureSecs: number[] = [];
  private durationSec = 0;

  private playing = false;
  private metronomeEnabled = false;
  /** The real recording (M13). When set it is the transport's clock + sound;
   *  the synth only clicks the metronome. Null ⇒ no transport (App gates it). */
  private track: AudioTrack | null = null;
  /** audioTime = scoreTime + audioOffsetSec — the recording's lead-in trim
   *  (~one bar). Set automatically from the tempo/meter when a track loads
   *  (M13); see `setTrack`. Not user-adjustable. */
  private audioOffsetSec = 0;

  /** Authoritative playhead while paused; while playing, derived from the clock. */
  private positionSec = 0;
  /** AudioContext time that maps to playhead 0; valid only while playing. */
  private startCtxTime = 0;

  private nextChordIdx = 0;
  private nextMetroIdx = 0;
  private shownOnsetIdx = -1;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(synth: Synth, onChange: (state: TransportState) => void) {
    this.synth = synth;
    this.onChange = onChange;
  }

  /**
   * (Re)load a schedule + cursor. Normally stops playback and resets to the top
   * — but if a recording is *playing*, the rebuild keeps it going: the timing
   * arrays below are tempo-derived and unchanged by a chord edit, so the review
   * loop (edit chords while listening) isn't interrupted by the re-render.
   */
  load(schedule: PlaybackSchedule, cursor: CursorController): void {
    const keepPlaying = this.track != null && this.playing;
    if (!keepPlaying) {
      this.stopTimer();
      this.synth.allOff();
    }
    this.schedule = schedule;
    this.cursor = cursor;

    this.chordSecs = schedule.chords.map((c) =>
      quarterToSeconds(c.startQuarter, schedule.tempoSegments),
    );
    this.chordDurs = schedule.chords.map(
      (c, i) =>
        quarterToSeconds(
          c.startQuarter + c.durationQuarter,
          schedule.tempoSegments,
        ) - this.chordSecs[i],
    );
    this.chordPitches = schedule.chords.map((c) => c.pitches);
    this.onsetSecs = schedule.onsets.map((o) =>
      quarterToSeconds(o.startQuarter, schedule.tempoSegments),
    );
    this.metroSecs = schedule.metronome.map((m) =>
      quarterToSeconds(m.startQuarter, schedule.tempoSegments),
    );
    this.metroAccents = schedule.metronome.map((m) => m.isDownbeat);
    this.measureSecs = schedule.measureStartQuarters.map((q) =>
      quarterToSeconds(q, schedule.tempoSegments),
    );
    // The recording (if loaded) owns the timeline; else the chart's length.
    this.durationSec = this.track ? this.track.duration : schedule.totalSeconds;

    if (keepPlaying) {
      // Re-sync the metronome pointer to where the audio is now.
      this.nextMetroIdx = firstIndexAtOrAfter(
        this.metroSecs,
        this.getPosition() - this.audioOffsetSec,
      );
    } else {
      this.playing = false;
      this.positionSec = 0;
      this.shownOnsetIdx = -1;
      this.syncCursor(0);
      // Idle state: positioned at the top but hidden until the user plays/scrubs.
      this.cursor?.hide();
    }
    this.emit();
  }

  play(): void {
    if (!this.schedule || this.playing) return;

    // M13 — recording mode: the <audio> element is the clock + sound; the synth
    // only clicks the metronome (no chord scheduling).
    if (this.track) {
      void this.synth.resume();
      this.playing = true;
      if (this.getPosition() >= this.durationSec) this.track.seek(0);
      this.nextMetroIdx = firstIndexAtOrAfter(
        this.metroSecs,
        this.getPosition() - this.audioOffsetSec,
      );
      void this.track.play();
      this.startTimer();
      this.emit();
      return;
    }

    // Restart from the top if we're parked at the end.
    if (this.positionSec >= this.durationSec) {
      this.positionSec = 0;
      this.syncCursor(0);
    }

    void this.synth.resume();
    this.playing = true;
    this.startCtxTime = this.synth.now - this.positionSec;
    this.resetPointers(this.positionSec);
    this.strikeHeldChord(this.positionSec);
    this.cursor?.show();
    this.startTimer();
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    if (this.track) {
      this.track.pause();
      this.playing = false;
      this.stopTimer();
      this.synth.allOff();
      this.emit();
      return;
    }
    this.positionSec = this.getPosition();
    this.playing = false;
    this.stopTimer();
    this.synth.allOff();
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Jump to `sec` (clamped). Works whether playing or paused. */
  seek(sec: number): void {
    if (!this.schedule) return;
    if (this.track) {
      const t = Math.max(0, Math.min(sec, this.durationSec || this.track.duration));
      this.track.seek(t);
      this.synth.allOff();
      this.nextMetroIdx = firstIndexAtOrAfter(
        this.metroSecs,
        t - this.audioOffsetSec,
      );
      this.emit();
      return;
    }
    const target = Math.max(0, Math.min(sec, this.durationSec));
    this.synth.allOff();
    this.positionSec = target;
    if (this.playing) {
      this.startCtxTime = this.synth.now - target;
      this.resetPointers(target);
      this.strikeHeldChord(target);
    }
    this.syncCursor(target);
    // Reveal the playhead when scrubbing, even from the idle state.
    this.cursor?.show();
    this.emit();
  }

  /**
   * Move the playhead to the start of measure `i` (clamped) and, if playing,
   * keep playing from there — the click-a-bar-to-seek interaction (M5). No-op
   * for an out-of-range index or a schedule with no measures.
   */
  seekToMeasure(i: number): void {
    if (i < 0 || i >= this.measureSecs.length) return;
    // In recording mode the seek bar is the audio timeline, so map bar→audio.
    this.seek(
      this.track ? this.measureSecs[i] + this.audioOffsetSec : this.measureSecs[i],
    );
  }

  /**
   * Sound a chord once as editor feedback (M6 audition), independent of
   * transport state — used when a chord is added/updated or previewed in the
   * popover. Overlaps harmlessly with playback if it happens to be running.
   */
  previewChord(pitches: number[]): void {
    if (pitches.length === 0) return;
    void this.synth.resume();
    // Routed through the synth's preview path so it rings its full span even if
    // the chord edit's re-render (or a seek/deselect) triggers `allOff()`.
    this.synth.previewChord(pitches, PREVIEW_SEC);
  }

  setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
    // Don't backfill clicks: resume scheduling from the current playhead.
    if (this.playing) {
      this.nextMetroIdx = firstIndexAtOrAfter(
        this.metroSecs,
        this.getPosition() - (this.track ? this.audioOffsetSec : 0),
      );
    }
    this.emit();
  }

  getPosition(): number {
    if (this.track) {
      const max = this.durationSec || this.track.duration;
      return max > 0
        ? Math.max(0, Math.min(this.track.currentTime, max))
        : Math.max(0, this.track.currentTime);
    }
    if (this.playing) {
      return Math.max(
        0,
        Math.min(this.synth.now - this.startCtxTime, this.durationSec),
      );
    }
    return this.positionSec;
  }

  dispose(): void {
    this.stopTimer();
    this.synth.allOff();
    this.track?.dispose();
    this.track = null;
  }

  /**
   * Attach (or clear) the real recording (M13). When set it becomes the
   * transport's clock + sound; disposes any previous track. Duration follows the
   * audio once its metadata loads.
   */
  setTrack(track: AudioTrack | null, audioOffsetSec = 0): void {
    this.stopTimer();
    this.synth.allOff();
    if (this.track && this.track !== track) this.track.dispose();
    this.track = track;
    this.audioOffsetSec = audioOffsetSec;
    this.playing = false;
    if (track) {
      this.durationSec = track.duration;
      track.whenReady(() => {
        this.durationSec = track.duration;
        this.emit();
      });
    }
    this.emit();
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private startTimer(): void {
    if (this.timer != null) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (!this.schedule || !this.playing) return;
    if (this.track) {
      this.tickTrack();
      return;
    }
    const pos = this.getPosition();
    const windowEnd = pos + LOOKAHEAD_SEC;

    // Sound each chord region as it enters the look-ahead window: one block
    // voicing per harmony change, sustained for its whole span (Berklee — the
    // slashes keep time, they don't re-trigger the chord; see schedule.ts).
    while (
      this.nextChordIdx < this.chordSecs.length &&
      this.chordSecs[this.nextChordIdx] < windowEnd
    ) {
      const i = this.nextChordIdx++;
      if (this.chordPitches[i].length > 0) {
        this.synth.playChord(
          this.chordPitches[i],
          this.startCtxTime + this.chordSecs[i],
          this.chordDurs[i],
        );
      }
    }

    // Schedule metronome clicks in the window (when enabled). When disabled we
    // do nothing — `setMetronome` re-syncs the pointer on re-enable, so there's
    // no backfill to guard against here.
    if (this.metronomeEnabled) {
      while (
        this.nextMetroIdx < this.metroSecs.length &&
        this.metroSecs[this.nextMetroIdx] < windowEnd
      ) {
        const i = this.nextMetroIdx++;
        this.synth.click(
          this.startCtxTime + this.metroSecs[i],
          this.metroAccents[i],
        );
      }
    }

    this.syncCursor(pos);

    if (pos >= this.durationSec) {
      this.finish();
      return;
    }
    this.emit();
  }

  /**
   * Recording-mode tick (M13): schedule metronome clicks against the audio clock
   * and advance the bar-highlight; no chord scheduling (the recording is the
   * sound). Clicks are re-anchored to the sampled audio position each tick, so
   * they never drift from the track.
   */
  private tickTrack(): void {
    if (!this.track) return;
    const audioPos = this.getPosition();
    const scorePos = audioPos - this.audioOffsetSec;
    const windowEnd = scorePos + LOOKAHEAD_SEC;

    if (this.metronomeEnabled) {
      while (
        this.nextMetroIdx < this.metroSecs.length &&
        this.metroSecs[this.nextMetroIdx] < windowEnd
      ) {
        const i = this.nextMetroIdx++;
        this.synth.click(
          this.synth.now + (this.metroSecs[i] - scorePos),
          this.metroAccents[i],
        );
      }
    }

    if (
      audioPos >= (this.durationSec || this.track.duration) ||
      this.track.ended
    ) {
      this.finish();
      return;
    }
    this.emit();
  }

  private finish(): void {
    this.playing = false;
    this.track?.pause();
    this.positionSec = this.durationSec;
    this.stopTimer();
    this.synth.allOff();
    this.emit();
  }

  /** Move audio-scheduling pointers to the first events at/after `sec`. */
  private resetPointers(sec: number): void {
    this.nextChordIdx = firstIndexAtOrAfter(this.chordSecs, sec);
    this.nextMetroIdx = firstIndexAtOrAfter(this.metroSecs, sec);
  }

  /**
   * When playback (re)starts inside a chord region — e.g. seeking into the
   * middle of a held chord — strike that chord for its remaining span so the
   * current harmony is audible. Regions starting at/after `sec` are left to the
   * normal look-ahead loop (guarding against a double strike).
   */
  private strikeHeldChord(sec: number): void {
    let i = -1;
    for (let k = 0; k < this.chordSecs.length; k++) {
      if (this.chordSecs[k] < sec) i = k;
      else break;
    }
    if (i < 0) return;
    const remaining = this.chordSecs[i] + this.chordDurs[i] - sec;
    if (remaining > 0 && this.chordPitches[i].length > 0) {
      this.synth.playChord(this.chordPitches[i], this.synth.now, remaining);
    }
  }

  /** Drive the OSMD cursor to the onset sounding at `sec`. */
  private syncCursor(sec: number): void {
    if (!this.cursor || this.onsetSecs.length === 0) return;
    const target = onsetIndexAt(this.onsetSecs, sec);
    if (target === this.shownOnsetIdx) return;

    // Seeking backward (or first show) restarts from the top; otherwise step.
    if (target < this.shownOnsetIdx || this.shownOnsetIdx < 0) {
      this.cursor.reset();
      this.shownOnsetIdx = 0;
    }
    while (this.shownOnsetIdx < target) {
      this.cursor.next();
      this.shownOnsetIdx++;
    }
  }

  /** Measure index containing `sec` (largest start ≤ sec); -1 if no measures. */
  private measureAt(sec: number): number {
    if (this.measureSecs.length === 0) return -1;
    return onsetIndexAt(this.measureSecs, sec);
  }

  private emit(): void {
    const pos = this.getPosition();
    const scorePos = this.track ? pos - this.audioOffsetSec : pos;
    this.onChange({
      positionSec: pos,
      durationSec: this.durationSec,
      isPlaying: this.playing,
      metronome: this.metronomeEnabled,
      currentMeasure: this.measureAt(scorePos),
      hasAudio: this.track != null,
    });
  }
}

/** First index `i` with `arr[i] >= value` (arr sorted ascending); else length. */
function firstIndexAtOrAfter(arr: number[], value: number): number {
  let i = 0;
  while (i < arr.length && arr[i] < value) i++;
  return i;
}

/** Largest index `i` with `arr[i] <= value`; clamped to 0 (arr sorted asc). */
function onsetIndexAt(arr: number[], value: number): number {
  let idx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] <= value) idx = i;
    else break;
  }
  return idx;
}
