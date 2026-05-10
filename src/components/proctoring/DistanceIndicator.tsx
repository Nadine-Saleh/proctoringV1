import { AlertTriangle, ArrowLeftRight } from 'lucide-react';

interface DistanceIndicatorProps {
  faceDistanceCm: number;
  optimalDistanceCm: number;
}

const TOLERANCE_CM = 15;

export const DistanceIndicator = ({ faceDistanceCm, optimalDistanceCm }: DistanceIndicatorProps) => {
  const offTarget = Math.abs(faceDistanceCm - optimalDistanceCm) > TOLERANCE_CM;
  const fillWidth = Math.max(10, Math.min(90, faceDistanceCm));

  return (
    <div className="p-2 rounded bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <ArrowLeftRight className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-600">Distance</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-gray-900">~{faceDistanceCm}cm</span>
          {offTarget && <AlertTriangle className="w-3 h-3 text-orange-500 animate-pulse" />}
        </div>
      </div>
      <div className="mt-1 relative h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${offTarget ? 'bg-orange-400' : 'bg-green-400'}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
    </div>
  );
};
