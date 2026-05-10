interface ScoreBadgeProps {
  score: number;
  warningCrossed: boolean;
  criticalCrossed: boolean;
}

export const ScoreBadge = ({ score, warningCrossed, criticalCrossed }: ScoreBadgeProps) => {
  const styles = criticalCrossed
    ? 'bg-red-50 border-red-200 text-red-700'
    : warningCrossed
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-gray-50 border-gray-200 text-gray-600';

  return (
    <div className={`mb-3 p-2 rounded-lg border text-sm font-medium flex items-center justify-between ${styles}`}>
      <span>Monitoring Score</span>
      <span className="font-mono font-bold">{Math.round(score)}</span>
    </div>
  );
};
