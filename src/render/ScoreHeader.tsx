import type { ScoreInfo } from '../model/scoreInfo';
import './ScoreHeader.css';

interface ScoreHeaderProps {
  info: ScoreInfo;
}

/**
 * Document header (M4, promoted from post-MVP P1): the song title with a
 * Key · Tempo subline beneath it, sitting on the same white "paper" as the
 * score. Replaces OSMD's own SVG title (`drawTitle: false`) so it's plain HTML —
 * styled to the design language and **live** (re-reads `info` on every edit).
 * App-display only; embedding it in the printed score is post-MVP (P4).
 *
 * Key and tempo are always present (defaulted on load — `model/defaults.ts`);
 * the muted-italic placeholder is a defensive fallback. Feel/style is optional
 * and not shown here — surfacing/editing it is a post-MVP feature (the reader
 * stays in `scoreInfo`). A missing title shows a muted "Untitled chart".
 */
export function ScoreHeader({ info }: ScoreHeaderProps) {
  return (
    <header className="score-header">
      <h1 className={titleClass(info.title)}>{info.title ?? 'Untitled chart'}</h1>
      <p className="score-header__subline">
        <Slot value={info.key} placeholder="no key" />
        <span className="score-header__dot">·</span>
        <Slot
          value={info.tempo != null ? `${info.tempo} BPM` : null}
          placeholder="no tempo"
        />
      </p>
    </header>
  );
}

function titleClass(title: string | null): string {
  return title ? 'score-header__title' : 'score-header__title is-empty';
}

/** A subline value, or a muted/italic placeholder when it's missing. */
function Slot({ value, placeholder }: { value: string | null; placeholder: string }) {
  if (value) return <span className="score-header__slot">{value}</span>;
  return <span className="score-header__slot is-empty">{placeholder}</span>;
}
