import { MicOff } from 'lucide-react';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { DistanceSetupModal } from '../../components/DistanceSetupModal';
import { ExamSubmissionModal } from '../../components/ExamSubmissionModal';
import { MicrophonePermissionModal } from '../../components/MicrophonePermissionModal';
import { PoseDetectionOverlay } from '../../components/PoseDetectionOverlay';
import { ExamHeader } from '../../components/layout/ExamHeader';
import { WarningBanner } from '../../components/layout/WarningBanner';
import { QuestionPanel } from '../../components/questions/QuestionPanel';
import { ProctoringSidebar } from '../../components/proctoring/ProctoringSidebar';
import { useExamFlow } from '../../hooks/useExamFlow';

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

export const Exam = () => {
  const flow = useExamFlow();

  if (flow.sessionLoading) return <LoadingScreen message="Loading exam session..." />;

  if (!flow.currentExam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No exam selected</h1>
          <p className="text-gray-600 mb-4">Please navigate from the home page and select an exam.</p>
          <button
            onClick={() => flow.navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (flow.examStarted && flow.questions.length === 0) {
    return <LoadingScreen message="Loading exam questions..." />;
  }

  if (flow.showDistanceSetup) {
    return <DistanceSetupModal onComplete={flow.handleSetOptimalDistance} />;
  }

  if (flow.showLivenessCheck) {
    return (
      <LivenessCheckModal
        isOpen={flow.showLivenessCheck}
        isChecking={flow.liveness.isChecking}
        isPassed={flow.liveness.isPassed}
        isFailed={flow.liveness.isFailed}
        progress={flow.liveness.progress}
        instruction={flow.liveness.instruction}
        currentStep={flow.liveness.currentStep}
        stepIndex={flow.liveness.stepIndex}
        totalSteps={flow.liveness.totalSteps}
        videoRef={flow.setLivenessVideoRef}
        onStartCheck={flow.liveness.startCheck}
        onRetry={flow.handleLivenessRetry}
        onContinue={flow.handleLivenessComplete}
      />
    );
  }

  if (flow.showMicrophonePermission) {
    return (
      <MicrophonePermissionModal
        isOpen={flow.showMicrophonePermission}
        onComplete={flow.handleMicrophoneComplete}
      />
    );
  }

  const question = flow.questions[flow.currentQuestion];
  const progress = flow.questions.length > 0
    ? ((flow.currentQuestion + 1) / flow.questions.length) * 100
    : 0;

  const showMicWarning = flow.examStarted && !flow.micActive;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col">
        {flow.warningBanner && (
          <WarningBanner banner={flow.warningBanner} onDismiss={() => flow.setWarningBanner(null)} />
        )}

        <ExamHeader
          title={flow.currentExam.title}
          currentQuestion={flow.currentQuestion}
          totalQuestions={flow.questions.length}
          timeRemaining={flow.timeRemaining}
          answeredCount={flow.answeredCount}
        />

        {showMicWarning && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 my-4">
            <div className="flex items-center">
              <MicOff className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
              <p className="text-sm font-medium text-red-800">
                Microphone connection lost. Please check your microphone and refresh the page.
              </p>
            </div>
          </div>
        )}

        {question && (
          <QuestionPanel
            question={question}
            selectedAnswer={flow.answers.get(question.id)}
            currentIndex={flow.currentQuestion}
            totalQuestions={flow.questions.length}
            progress={progress}
            onSelectAnswer={flow.handleSelectAnswer}
            onPrevious={flow.goToPreviousQuestion}
            onNext={flow.goToNextQuestion}
            onSubmit={flow.handleSubmit}
          />
        )}
      </div>

      <ProctoringSidebar
        status={flow.status}
        videoRef={flow.setCombinedVideoRef}
        onRetryCamera={flow.retryCamera}
        examStarted={flow.examStarted}
        liveScore={flow.liveScore}
        warningThresholdCrossed={flow.warningThresholdCrossed}
        criticalThresholdCrossed={flow.criticalThresholdCrossed}
        gazeRunning={flow.gazeRunning}
        gazeLookingAway={flow.gazeStatus === 'looking-away'}
        faceDistanceCm={flow.faceDistanceCm}
        sessionCalibration={flow.sessionCalibration}
        hasSession={!!flow.session}
        questions={flow.questions}
        currentQuestion={flow.currentQuestion}
        answers={flow.answers}
        onSelectQuestion={flow.setCurrentQuestion}
        cameraOverlay={
          <PoseDetectionOverlay
            videoElement={flow.combinedVideoElement}
            isDetecting={flow.poseDetecting}
            frameStatus={flow.poseFrameStatus}
            statusMessage={flow.poseStatusMessage}
            isModelLoaded={flow.poseModelLoaded}
          />
        }
        poseDetecting={flow.poseDetecting}
        poseFrameValid={flow.poseFrameStatus === 'valid'}
        poseLoadingProgress={flow.poseLoadingProgress}
        micActive={flow.micActive}
        micStreamHealthy={flow.micStreamHealthy}
      />

      {flow.sessionError && (
        <div className="fixed bottom-4 right-4 z-40 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <p className="text-sm font-medium">Session Error</p>
          <p className="text-xs mt-1">{flow.sessionError}</p>
        </div>
      )}

      {flow.submissionError && (
        <div className="fixed bottom-4 right-4 z-40 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <p className="text-sm font-medium">Submission Failed</p>
          <p className="text-xs mt-1">{flow.submissionError}</p>
          <button onClick={() => flow.setSubmissionError(null)} className="text-xs underline mt-2">
            Dismiss
          </button>
        </div>
      )}

      <ExamSubmissionModal
        isOpen={flow.showSubmissionModal}
        totalQuestions={flow.questions.length}
        answeredCount={flow.answeredCount}
        timeElapsed={flow.timeElapsed}
        isSubmitting={flow.isSubmitting}
        onConfirm={flow.handleFinalSubmit}
        onCancel={flow.handleCancelSubmit}
      />
    </div>
  );
};
