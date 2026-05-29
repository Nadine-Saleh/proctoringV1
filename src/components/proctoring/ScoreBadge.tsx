import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  warningCrossed: boolean;
  criticalCrossed: boolean;
}

export const ScoreBadge = ({ score, warningCrossed, criticalCrossed }: ScoreBadgeProps) => {
  const display = Math.round(score);
  const pct = Math.max(0, Math.min(100, display));

  const tone = criticalCrossed ? 'danger' : warningCrossed ? 'warning' : 'success';

  const config = {
    danger: {
      label: 'Critical risk',
      Icon: ShieldX,
      ring: 'ring-danger-200',
      iconBg: 'bg-danger-50 text-danger-600',
      barFrom: 'from-danger-500',
      barTo: 'to-danger-600',
      score: 'text-danger-700',
      pulse: true,
    },
    warning: {
      label: 'Elevated risk',
      Icon: ShieldAlert,
      ring: 'ring-warning-200',
      iconBg: 'bg-warning-50 text-warning-600',
      barFrom: 'from-warning-400',
      barTo: 'to-warning-500',
      score: 'text-warning-700',
      pulse: false,
    },
    success: {
      label: 'All clear',
      Icon: ShieldCheck,
      ring: 'ring-success-200',
      iconBg: 'bg-success-50 text-success-600',
      barFrom: 'from-success-400',
      barTo: 'to-success-500',
      score: 'text-success-700',
      pulse: false,
    },
  }[tone];

  const { Icon } = config;

  return (
    <div
      className={`mb-4 relative overflow-hidden rounded-xl bg-white border border-ink-100 ring-1 ${config.ring} shadow-soft p-4`}
    >
      {config.pulse && (
        <div className="absolute inset-0 bg-danger-50/40 animate-pulse-soft pointer-events-none" />
      )}
      <div className="relative flex items-center gap-3 mb-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.iconBg}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
            Risk Index
          </div>
          <div className="text-sm font-medium text-ink-800 leading-tight">{config.label}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold font-mono tabular-nums leading-none ${config.score}`}>
            {display}
          </div>
          <div className="text-2xs text-ink-400 mt-0.5">/ 100</div>
        </div>
      </div>

      {/* Segmented risk bar */}
      <div className="relative h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${config.barFrom} ${config.barTo} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
        {/* threshold ticks */}
        <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: '40%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: '75%' }} />
      </div>
      <div className="flex justify-between text-2xs text-ink-400 mt-1.5">
        <span>Safe</span>
        <span>Watch</span>
        <span>Critical</span>
      </div>
    </div>
  );
};
