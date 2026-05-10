import { CheckCircle } from 'lucide-react';
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
  <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
    <div className="p-6 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Monitor</h3>

      <CameraFeed
        status={status}
        videoRef={videoRef}
        onRetry={onRetryCamera}
        overlay={cameraOverlay}
      />

      {examStarted && liveScore > 0 && (
        <ScoreBadge
          score={liveScore}
          warningCrossed={warningThresholdCrossed}
          criticalCrossed={criticalThresholdCrossed}
        />
      )}

      <div className="space-y-3">
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

        {examStarted && faceDistanceCm && sessionCalibration?.optimal_distance_cm && (
          <DistanceIndicator
            faceDistanceCm={faceDistanceCm}
            optimalDistanceCm={sessionCalibration.optimal_distance_cm}
          />
        )}

        {hasSession && (
          <div className="p-2 rounded bg-green-50 border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-700 font-medium">Session Active</span>
              <CheckCircle className="w-3 h-3 text-green-600" />
            </div>
          </div>
        )}
      </div>
    </div>

    <QuestionNavigator
      questions={questions}
      currentIndex={currentQuestion}
      answers={answers}
      onSelect={onSelectQuestion}
    />
  </div>
);
