import { ShieldAlert } from 'lucide-react';
import type { WarningBannerState } from '../../types/exam';

interface WarningBannerProps {
  banner: WarningBannerState;
  onDismiss: () => void;
}

const LEVEL_STYLES: Record<WarningBannerState['level'], string> = {
  critical: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-500 text-white',
};

export const WarningBanner = ({ banner, onDismiss }: WarningBannerProps) => (
  <div className={`px-6 py-2 flex items-center gap-3 text-sm font-medium ${LEVEL_STYLES[banner.level]}`}>
    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
    <span>{banner.message}</span>
    <button onClick={onDismiss} className="ml-auto opacity-70 hover:opacity-100 text-xs underline">
      Dismiss
    </button>
  </div>
);
