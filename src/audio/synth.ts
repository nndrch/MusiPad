/**
 * A tiny self-contained Web Audio synth for chord realization (PRD §7.1, M2).
 *
 * Why not a soundfont package: the PRD names `soundfont-player` only as an
 * example ("Web Audio soundfont, e.g. …"). A sampled soundfont pulls instrument
 * audio from a CDN at runtime — a network dependency that fails offline and in
 * tests. For the PoC headline we instead synthesize block chords with plain
 * oscillators + a gentle envelope: zero dependencies, deterministic, works
 * offline. Nicer timbre (real soundfont) is a clean post-MVP swap behind this
 * same interface. (Approach flagged in the M2 PR, per PRD §11.)
 *
 * All scheduling is against the AudioContext clock (`currentTime`), so the
 * transport's look-ahead scheduler (`player.ts`) gets sample-accurate timing.
 */

import { midiToFreq } from './voicing';

/** A scheduled, still-ringing voice we can stop early on pause/seek. */
interface ActiveVoice {
  sources: OscillatorNode[];
  gain: GainNode;
}

export class Synth {
  private ctx: AudioContext;
  private master: GainNode;
  /** Transport voices (playback/metronome) — silenced by `allOff` on pause/seek/stop. */
  private active = new Set<ActiveVoice>();
  /**
   * Editor-audition voices (M6 `previewChord`) — tracked separately so a
   * transport `allOff()` (pause/seek/stop, or a schedule rebuild after a chord
   * edit) never truncates them. Without this an audition was struck then
   * silenced ~100 ms later by the edit's re-render → "percussive pulse".
   */
  private previews = new Set<ActiveVoice>();

  constructor() {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctor();

    // A compressor on the master bus keeps dense voicings from clipping.
    const comp = this.ctx.createDynamicsCompressor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
  }

  /** AudioContext clock — the reference time for all scheduling. */
  get now(): number {
    return this.ctx.currentTime;
  }

  /**
   * Resume the context. Browsers start it `suspended` until a user gesture, so
   * call this from the play-button handler. Returns once running.
   */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
  }

  /**
   * Schedule a block chord at `atTime` (AudioContext seconds), sustained for
   * `durationSec` — the transport's playback/seek voices (silenced by `allOff`).
   */
  playChord(pitches: number[], atTime: number, durationSec: number): void {
    this.scheduleChord(pitches, atTime, durationSec, this.active);
  }

  /**
   * Sound a chord *now* as editor feedback (M6 audition), **independent of the
   * transport**: it rings its full `durationSec` even if a pause/seek/stop or a
   * post-edit schedule rebuild calls `allOff()` in the meantime. Only the latest
   * audition rings — a new one fades any still-ringing preview first.
   */
  previewChord(pitches: number[], durationSec: number): void {
    this.stopPreviews();
    this.scheduleChord(pitches, this.now, durationSec, this.previews);
  }

  /**
   * Build one block-chord voice into `registry`. Each MIDI pitch gets a triangle
   * oscillator through a shared attack–decay–sustain–release envelope,
   * gain-compensated for voice count.
   */
  private scheduleChord(
    pitches: number[],
    atTime: number,
    durationSec: number,
    registry: Set<ActiveVoice>,
  ): void {
    if (pitches.length === 0 || durationSec <= 0) return;
    // Under a delayed tick a region can land just behind the clock; clamp so it
    // sounds immediately rather than being scheduled in the past (Web Audio
    // would otherwise mangle the past-dated envelope ramps).
    atTime = Math.max(atTime, this.now);

    const gain = this.ctx.createGain();
    gain.connect(this.master);

    // A sustained pad-ish envelope so the chord is audible for the *whole*
    // region (one chord held until the next change), not a per-beat pluck:
    // attack → short decay to a sustain plateau → release at the region end.
    // Normalize so a 5-note voicing isn't 5× louder than a single note.
    const peak = 0.2 / Math.sqrt(pitches.length);
    const sustainLevel = peak * 0.72;
    const attack = 0.01;
    const decay = 0.12;
    const release = 0.18;
    const end = atTime + Math.max(durationSec, attack + release + 0.02);
    const releaseStart = Math.max(atTime + attack + decay, end - release);

    const g = gain.gain;
    g.setValueAtTime(0.0001, atTime);
    g.exponentialRampToValueAtTime(peak, atTime + attack);
    g.exponentialRampToValueAtTime(sustainLevel, atTime + attack + decay);
    g.setValueAtTime(sustainLevel, releaseStart); // hold the plateau
    g.exponentialRampToValueAtTime(0.0001, end);

    const sources: OscillatorNode[] = [];
    for (const midi of pitches) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(midi);
      osc.connect(gain);
      osc.start(atTime);
      osc.stop(end + 0.03);
      sources.push(osc);
    }

    const voice: ActiveVoice = { sources, gain };
    registry.add(voice);
    sources[0].onended = () => {
      gain.disconnect();
      registry.delete(voice);
    };
  }

  /**
   * Schedule a metronome click at `atTime`. Downbeats are a touch higher and
   * louder so the bar is audible (PRD §6.2).
   */
  click(atTime: number, accent: boolean): void {
    atTime = Math.max(atTime, this.now);
    const gain = this.ctx.createGain();
    gain.connect(this.master);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1600 : 1000;
    osc.connect(gain);

    const peak = accent ? 0.18 : 0.12;
    const dur = 0.035;
    gain.gain.setValueAtTime(0.0001, atTime);
    gain.gain.exponentialRampToValueAtTime(peak, atTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + dur);

    osc.start(atTime);
    osc.stop(atTime + dur + 0.01);

    const voice: ActiveVoice = { sources: [osc], gain };
    this.active.add(voice);
    osc.onended = () => {
      gain.disconnect();
      this.active.delete(voice);
    };
  }

  /**
   * Silence the **transport** voices immediately (tiny fade to avoid a click)
   * and cancel any scheduled-but-not-started notes. Used on pause/seek/stop and
   * on schedule reloads. Editor auditions (`previews`) are intentionally left to
   * ring out — they're independent of the transport.
   */
  allOff(): void {
    this.fadeOut(this.active);
  }

  /** Fade out any still-ringing editor audition (a new audition supersedes it). */
  private stopPreviews(): void {
    this.fadeOut(this.previews);
  }

  /** Quick fade + stop for every voice in a registry. */
  private fadeOut(registry: Set<ActiveVoice>): void {
    const t = this.now;
    for (const voice of registry) {
      try {
        voice.gain.gain.cancelScheduledValues(t);
        voice.gain.gain.setTargetAtTime(0.0001, t, 0.01);
        for (const osc of voice.sources) osc.stop(t + 0.05);
      } catch {
        // A source may already have stopped; ignore.
      }
    }
  }

  /** Tear down the AudioContext. */
  dispose(): void {
    this.allOff();
    this.stopPreviews();
    void this.ctx.close();
  }
}
