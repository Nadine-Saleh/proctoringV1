import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  Mic,
  MicOff,
  Monitor,
  ScanFace,
  StretchHorizontal,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProctoringStatus } from '../../hooks/useProctoring';

interface StatusIndicatorsProps {
  status: ProctoringStatus;
  gazeRunning: boolean;
  gazeLookingAway: boolean;
  poseDetecting?: boolean;
  poseFrameValid?: boolean;
  poseLoadingProgress?: string;
  micActive?: boolean;
  micStreamHealthy?: boolean;
}

type SignalState = 'good' | 'warn' | 'bad' | 'idle' | 'loading';

const STATE_STYLES: Record<SignalState, { dot: string; text: string; bg: string; pulse: boolean }> = {
  good:    { dot: 'bg-success-500', text: 'text-success-700', bg: 'bg-success-50/60',  pulse: true },
  warn:    { dot: 'bg-warning-500', text: 'text-warning-700', bg: 'bg-warning-50/60',  pulse: true },
  bad:     { dot: 'bg-danger-500',  text: 'text-danger-700',  bg: 'bg-danger-50/60',   pulse: true },
  idle:    { dot: 'bg-ink-300',     text: 'text-ink-500',     bg: 'bg-ink-50',         pulse: false },
  loading: { dot: 'bg-ink-300',     text: 'text-ink-500',     bg: 'bg-ink-50',         pulse: false },
};

const SignalRow = ({
  icon,
  label,
  state,
  detail,
}: {
  icon: ReactNode;
  label: string;
  state: SignalState;
  detail?: string;
}) => {
  const s = STATE_STYLES[state];
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-ink-100 hover:border-ink-200 transition-colors">
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
        <span className={s.text}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-800 leading-tight truncate">{label}</div>
        {detail && (
          <div className="text-2xs text-ink-500 mt-0.5 truncate tabular-nums">{detail}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {state === 'loading' ? (
          <div className="w-3.5 h-3.5 border-2 border-ink-300 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="relative flex w-2 h-2">
            {s.pulse && (
              <span className={`absolute inset-0 rounded-full ${s.dot} opacity-60 animate-ping`} />
            )}
            <span className={`relative inline-flex rounded-full w-2 h-2 ${s.dot}`} />
          </span>
        )}
      </div>
    </div>
  );
};

export const StatusIndicators = ({
  status,
  gazeRunning,
  gazeLookingAway,
  poseDetecting,
  poseFrameValid,
  poseLoadingProgress,
  micActive,
  micStreamHealthy,
}: StatusIndicatorsProps) => (
  <div className="space-y-1.5">
    <SignalRow
      icon={<Camera className="w-4 h-4" />}
      label="Camera feed"
      state={status.camera ? 'good' : 'bad'}
      detail={status.camera ? 'Streaming' : 'Disconnected'}
    />

    <SignalRow
      icon={<ScanFace className="w-4 h-4" />}
      label={status.modelsLoaded ? 'Face detection' : 'Loading models'}
      state={!status.modelsLoaded ? 'loading' : status.faceDetected ? 'good' : 'warn'}
      detail={
        !status.modelsLoaded
          ? 'Initializing'
          : status.faceDetected
          ? 'Face locked'
          : 'No face detected'
      }
    />

    <SignalRow
      icon={<Eye className="w-4 h-4" />}
      label={gazeRunning ? 'Eye gaze' : 'Gaze tracking'}
      state={!gazeRunning ? 'loading' : gazeLookingAway ? 'bad' : 'good'}
      detail={
        !gazeRunning
          ? 'Calibrating'
          : gazeLookingAway
          ? 'Looking away'
          : 'On screen'
      }
    />

    <SignalRow
      icon={<Monitor className="w-4 h-4" />}
      label="Tab focus"
      state={status.tabActive ? 'good' : 'bad'}
      detail={status.tabActive ? 'Active window' : 'Out of focus'}
    />

    {poseDetecting !== undefined && (
      <SignalRow
        icon={<StretchHorizontal className="w-4 h-4" />}
        label={poseDetecting ? 'Pose detection' : poseLoadingProgress || 'Loading pose'}
        state={!poseDetecting ? 'loading' : poseFrameValid ? 'good' : 'warn'}
        detail={!poseDetecting ? 'Initializing' : poseFrameValid ? 'Posture valid' : 'Posture issue'}
      />
    )}

    {micActive !== undefined && (
      <SignalRow
        icon={micActive && micStreamHealthy ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        label="Microphone"
        state={micActive && micStreamHealthy ? 'good' : 'bad'}
        detail={micActive && micStreamHealthy ? 'Recording' : 'Disconnected'}
      />
    )}
  </div>
);

export const SignalRowItem = SignalRow;

// Re-export icons for convenience to consumers
export { CheckCircle2 as _StatusGoodIcon, AlertTriangle as _StatusBadIcon };
