import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ProctoringStatus } from '../../hooks/useProctoring';

interface StatusIndicatorsProps {
  status: ProctoringStatus;
  gazeRunning: boolean;
  gazeLookingAway: boolean;
}

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
);

const Row = ({
  label,
  state,
}: {
  label: string;
  state: 'good' | 'warn' | 'bad' | 'idle' | 'loading';
}) => {
  const styles = {
    good: { bg: 'bg-green-50', text: 'text-green-700' },
    warn: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
    bad: { bg: 'bg-red-50', text: 'text-red-700' },
    idle: { bg: 'bg-gray-50', text: 'text-gray-500' },
    loading: { bg: 'bg-gray-50', text: 'text-gray-500' },
  }[state];

  const icon =
    state === 'good' ? <CheckCircle className="w-4 h-4 text-green-600" />
    : state === 'warn' ? <AlertTriangle className="w-4 h-4 text-yellow-600" />
    : state === 'bad' ? <AlertTriangle className="w-4 h-4 text-red-600" />
    : <Spinner />;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${styles.bg}`}>
      <span className={`text-sm font-medium ${styles.text}`}>{label}</span>
      {icon}
    </div>
  );
};

export const StatusIndicators = ({ status, gazeRunning, gazeLookingAway }: StatusIndicatorsProps) => (
  <>
    <Row label="Camera" state={status.camera ? 'good' : 'bad'} />
    <Row
      label={status.modelsLoaded ? 'Face Detection' : 'Loading Models...'}
      state={!status.modelsLoaded ? 'loading' : status.faceDetected ? 'good' : 'warn'}
    />
    <Row label="Tab Status" state={status.tabActive ? 'good' : 'bad'} />
    <Row
      label={gazeRunning ? 'Eye Gaze' : 'Gaze Detection'}
      state={!gazeRunning ? 'loading' : gazeLookingAway ? 'bad' : 'good'}
    />
  </>
);
