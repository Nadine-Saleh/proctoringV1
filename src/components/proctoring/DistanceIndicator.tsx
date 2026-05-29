import { ArrowLeftRight } from 'lucide-react';

interface DistanceIndicatorProps {
  faceDistanceCm: number;
  optimalDistanceCm: number;
}

const TOLERANCE_CM = 15;
const RANGE_MIN = 20;
const RANGE_MAX = 100;

export const DistanceIndicator = ({ faceDistanceCm, optimalDistanceCm }: DistanceIndicatorProps) => {
  const offBy = faceDistanceCm - optimalDistanceCm;
  const offTarget = Math.abs(offBy) > TOLERANCE_CM;
  const tooClose = offBy < -TOLERANCE_CM;
  const tooFar = offBy > TOLERANCE_CM;

  const norm = (cm: number) => ((cm - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
  const facePos = Math.max(0, Math.min(100, norm(faceDistanceCm)));
  const optimalLeft = Math.max(0, Math.min(100, norm(optimalDistanceCm - TOLERANCE_CM)));
  const optimalRight = Math.max(0, Math.min(100, norm(optimalDistanceCm + TOLERANCE_CM)));

  const stateStyle = offTarget
    ? 'text-warning-700'
    : 'text-success-700';

  return (
    <div className="px-3 py-2.5 rounded-lg bg-white border border-ink-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-500">
          <ArrowLeftRight className="w-3 h-3" />
          Distance
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-sm font-semibold tabular-nums ${stateStyle}`}>{faceDistanceCm}</span>
          <span className="text-2xs text-ink-400">cm</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-1.5 bg-ink-100 rounded-full overflow-hidden">
        {/* Optimal zone */}
        <div
          className="absolute inset-y-0 bg-success-200/70"
          style={{ left: `${optimalLeft}%`, width: `${optimalRight - optimalLeft}%` }}
        />
        {/* Position marker */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-white shadow-sm transition-all duration-300 ${
            offTarget ? 'bg-warning-500' : 'bg-success-500'
          }`}
          style={{ left: `${facePos}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-2xs text-ink-400 mt-1.5 tabular-nums">
        <span>{RANGE_MIN}cm</span>
        {offTarget ? (
          <span className="text-warning-600 font-medium">
            {tooClose ? 'Move back' : tooFar ? 'Move closer' : 'Adjust'}
          </span>
        ) : (
          <span className="text-success-600 font-medium">In range</span>
        )}
        <span>{RANGE_MAX}cm</span>
      </div>
    </div>
  );
};
