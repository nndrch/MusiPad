/**
 * The real-recording playback source (PRD §6.7, M13). Wraps an `<audio>`
 * element fed an object-URL of the user-loaded `_stabilised.wav`. This is the
 * audio the reviewer corrects the chart against — it **replaces** the M2 synth
 * chord realization as the transport's sound + clock (the synth survives only
 * for the metronome click and the editor's audition).
 *
 * An `<audio>` element (vs. an `AudioBufferSource`) is deliberate: it supports
 * native pause / resume / seek, which the review transport needs. Its
 * `currentTime` is the master playback clock the bar-highlight follows; the
 * metronome is scheduled against the AudioContext clock relative to this
 * position each tick (see `player.ts`), so the two stay in step with no
 * cumulative drift.
 */
export class AudioTrack {
  readonly el: HTMLAudioElement;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
    this.el = new Audio(url);
    this.el.preload = 'auto';
  }

  /** Total length in seconds, or 0 until metadata has loaded. */
  get duration(): number {
    const d = this.el.duration;
    return Number.isFinite(d) ? d : 0;
  }

  /** Current playback position in audio seconds. */
  get currentTime(): number {
    return this.el.currentTime;
  }

  get ended(): boolean {
    return this.el.ended;
  }

  async play(): Promise<void> {
    await this.el.play();
  }

  pause(): void {
    this.el.pause();
  }

  /** Jump to `sec` (audio seconds), clamped to the track. */
  seek(sec: number): void {
    const max = this.duration || Number.POSITIVE_INFINITY;
    this.el.currentTime = Math.max(0, Math.min(sec, max));
  }

  /** Run `cb` once the duration is known (immediately if already loaded). */
  whenReady(cb: () => void): void {
    if (this.duration > 0) {
      cb();
      return;
    }
    this.el.addEventListener('loadedmetadata', cb, { once: true });
  }

  /** Stop, detach, and release the object-URL (owns its url's lifecycle). */
  dispose(): void {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    URL.revokeObjectURL(this.url);
  }
}
