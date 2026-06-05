import { Info, X } from 'lucide-react';
import './Banner.css';

interface BannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * A quiet, dismissible notice shown above the score (M4) — e.g. when a loaded
 * file was missing a key/tempo and we assigned defaults. Uses the soft
 * `--accent-tint` background (the design language's notice/active surface) so
 * it draws mild attention without a non-grayscale "warning" colour.
 */
export function Banner({ message, onDismiss }: BannerProps) {
  return (
    <div className="banner" role="status">
      <div className="banner__inner">
        <Info size={15} strokeWidth={1.75} className="banner__icon" />
        <span className="banner__text">{message}</span>
        <button
          type="button"
          className="banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
