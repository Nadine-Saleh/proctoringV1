import { ShieldAlert, ShieldX, Info, X } from 'lucide-react';
import type { WarningBannerState } from '../../types/exam';

interface WarningBannerProps {
  banner: WarningBannerState;
  onDismiss: () => void;
}

const LEVEL_CONFIG = {
  critical: {
    bg: 'bg-danger-600',
    text: 'text-white',
    accent: 'bg-danger-700',
    Icon: ShieldX,
    label: 'Critical',
  },
  warning: {
    bg: 'bg-warning-500',
    text: 'text-warning-950',
    accent: 'bg-warning-600',
    Icon: ShieldAlert,
    label: 'Warning',
  },
  info: {
    bg: 'bg-info-600',
    text: 'text-white',
    accent: 'bg-info-700',
    Icon: Info,
    label: 'Notice',
  },
} as const;

export const WarningBanner = ({ banner, onDismiss }: WarningBannerProps) => {
  const cfg = LEVEL_CONFIG[banner.level];
  const Icon = cfg.Icon;

  return (
    <div
      className={`relative ${cfg.bg} ${cfg.text} animate-slide-down shadow-md`}
      role="alert"
      aria-live="assertive"
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${cfg.accent}`} />
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="text-2xs font-semibold uppercase tracking-wider opacity-80">
            {cfg.label}
          </span>
          <span className="w-px h-4 bg-current opacity-30" />
          <span className="text-sm font-medium truncate">{banner.message}</span>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
