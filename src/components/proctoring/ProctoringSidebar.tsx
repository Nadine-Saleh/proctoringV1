import { Activity, Radio } from 'lucide-react';
import type { ReactNode, RefCallback } from 'react';
import type { ProctoringStatus } from '../../hooks/useProctoring';
import type { ExamQuestion, SessionCalibration } from '../../types/exam';
import { CameraFeed } from './CameraFeed';
import { StatusIndicators } from './StatusIndicators';
import { DistanceIndicator } from './DistanceIndicator';
import { ScoreBadge } from './ScoreBadge';
import { QuestionNavigator } from '../questions/QuestionNavigator';

interface ProctoringSidebarProps {
  status: ProctoringStatus;
  videoRef: RefCallback<HTMLVideoElement>;
  onRetryCamera: () => void;

  examStarted: boolean;
  liveScore: number;
  warningThresholdCrossed: boolean;
  criticalThresholdCrossed: boolean;

  gazeRunning: boolean;
  gazeLookingAway: boolean;

  faceDistanceCm: number | null;
  sessionCalibration: SessionCalibration | null;

  hasSession: boolean;

  questions: ExamQuestion[];
  currentQuestion: number;
  answers: Map<string, number>;
  onSelectQuestion: (index: number) => void;

  cameraOverlay?: ReactNode;
  poseDetecting?: boolean;
  poseFrameValid?: boolean;
  poseLoadingProgress?: string;
  micActive?: boolean;
  micStreamHealthy?: boolean;
}

export const ProctoringSidebar = ({
  status,
  videoRef,
  onRetryCamera,
  examStarted,
  liveScore,
  warningThresholdCrossed,
  criticalThresholdCrossed,
  gazeRunning,
  gazeLookingAway,
  faceDistanceCm,
  sessionCalibration,
  hasSession,
  questions,
  currentQuestion,
  answers,
  onSelectQuestion,
  cameraOverlay,
  poseDetecting,
  poseFrameValid,
  poseLoadingProgress,
  micActive,
  micStreamHealthy,
}: ProctoringSidebarProps) => (
  <aside
    className="w-[400px] flex-shrink-0 flex flex-col bg-white border-l border-ink-100 shadow-[-1px_0_24px_-12px_rgba(17,12,14,0.08)]"
    aria-label="Proctoring control panel"
  >
    {/* Header */}
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-brand-700">
              Mission Control
            </div>
            <h3 className="text-sm font-semibold text-ink-900 leading-tight">
              Proctoring Monitor
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-50 border border-ink-100">
          <Radio className={`w-3 h-3 ${hasSession ? 'text-success-600' : 'text-ink-400'}`} />
          <span
            className={`text-2xs font-semibold uppercase tracking-wider ${
              hasSession ? 'text-success-700' : 'text-ink-500'
            }`}
          >
            {hasSession ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <CameraFeed
        status={status}
        videoRef={videoRef}
        onRetry={onRetryCamera}
        overlay={cameraOverlay}
      />
    </div>

    {/* Telemetry */}
    <div className="px-5 pb-3">
      {examStarted && liveScore > 0 && (
        <ScoreBadge
          score={liveScore}
          warningCrossed={warningThresholdCrossed}
          criticalCrossed={criticalThresholdCrossed}
        />
      )}

      <div className="mb-3">
        <h4 className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Live Signals
        </h4>
        <StatusIndicators
          status={status}
          gazeRunning={gazeRunning}
          gazeLookingAway={gazeLookingAway}
          poseDetecting={poseDetecting}
          poseFrameValid={poseFrameValid}
          poseLoadingProgress={poseLoadingProgress}
          micActive={micActive}
          micStreamHealthy={micStreamHealthy}
        />
      </div>

      {examStarted && faceDistanceCm && sessionCalibration?.optimal_distance_cm && (
        <DistanceIndicator
          faceDistanceCm={faceDistanceCm}
          optimalDistanceCm={sessionCalibration.optimal_distance_cm}
        />
      )}
    </div>

    <div className="border-t border-ink-100 flex-1 flex flex-col min-h-0">
      <QuestionNavigator
        questions={questions}
        currentIndex={currentQuestion}
        answers={answers}
        onSelect={onSelectQuestion}
      />
    </div>
  </aside>
);
