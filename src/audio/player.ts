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

  /** (Re)load a schedule + cursor. Stops playback and resets to the top. */
  load(schedule: PlaybackSchedule, cursor: CursorController): void {
    this.stopTimer();
    this.synth.allOff();
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
    this.durationSec = schedule.totalSeconds;

    this.playing = false;
    this.positionSec = 0;
    this.shownOnsetIdx = -1;
    this.syncCursor(0);
    // Idle state: positioned at the top but hidden until the user plays/scrubs.
    this.cursor?.hide();
    this.emit();
  }

  play(): void {
    if (!this.schedule || this.playing) return;
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
    this.seek(this.measureSecs[i]);
  }

  /**
   * Sound a chord once as editor feedback (M6 audition), independent of
   * transport state — used when a chord is added/updated or previewed in the
   * popover. Overlaps harmlessly with playback if it happens to be running.
   */
  previewChord(pitches: number[]): void {
    if (pitches.length === 0) return;
    void this.synth.resume();
    this.synth.playChord(pitches, this.synth.now, PREVIEW_SEC);
  }

  setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
    // Don't backfill clicks: resume scheduling from the current playhead.
    if (this.playing) {
      this.nextMetroIdx = firstIndexAtOrAfter(
        this.metroSecs,
        this.getPosition(),
      );
    }
    this.emit();
  }

  getPosition(): number {
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

  private finish(): void {
    this.playing = false;
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
    this.onChange({
      positionSec: pos,
      durationSec: this.durationSec,
      isPlaying: this.playing,
      metronome: this.metronomeEnabled,
      currentMeasure: this.measureAt(pos),
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
