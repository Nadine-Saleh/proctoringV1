import { AlertCircle } from 'lucide-react';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { DistanceSetupModal } from '../../components/DistanceSetupModal';
import { ExamSubmissionModal } from '../../components/ExamSubmissionModal';
import { PoseDetectionOverlay } from '../../components/PoseDetectionOverlay';
import { ExamHeader } from '../../components/layout/ExamHeader';
import { WarningBanner } from '../../components/layout/WarningBanner';
import { QuestionPanel } from '../../components/questions/QuestionPanel';
import { ProctoringSidebar } from '../../components/proctoring/ProctoringSidebar';
import { useExamFlow } from '../../hooks/useExamFlow';

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
    <div className="text-center animate-fade-in">
      <div className="relative w-14 h-14 mx-auto mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-brand-100" />
        <div className="absolute inset-0 rounded-full border-2 border-t-brand-700 animate-spin" />
      </div>
      <p className="text-sm font-medium text-ink-700">{message}</p>
    </div>
  </div>
);

export const Exam = () => {
  const flow = useExamFlow();

  if (flow.sessionLoading) return <LoadingScreen message="Loading exam session..." />;

  if (!flow.currentExam) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-6">
        <div className="card max-w-md w-full text-center px-8 py-10 animate-fade-in-up">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-warning-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-warning-600" />
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mb-2 tracking-tight2">No exam selected</h1>
          <p className="text-sm text-ink-600 mb-6">
            Please navigate from the home page and select an exam to continue.
          </p>
          <button
            onClick={() => flow.navigate('/')}
            className="btn btn-md btn-primary w-full"
          >
            Go to home
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

  const question = flow.questions[flow.currentQuestion];
  const progress =
    flow.questions.length > 0 ? ((flow.currentQuestion + 1) / flow.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <div className="flex-1 flex flex-col min-w-0">
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
      />

      {flow.sessionError && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-fade-in-up">
          <div className="card border-danger-200 bg-white p-4 flex items-start gap-3 ring-1 ring-danger-200">
            <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-danger-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">Session error</p>
              <p className="text-xs text-ink-600 mt-0.5">{flow.sessionError}</p>
            </div>
          </div>
        </div>
      )}

      {flow.submissionError && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-fade-in-up">
          <div className="card border-danger-200 bg-white p-4 flex items-start gap-3 ring-1 ring-danger-200">
            <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-danger-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">Submission failed</p>
              <p className="text-xs text-ink-600 mt-0.5">{flow.submissionError}</p>
              <button
                onClick={() => flow.setSubmissionError(null)}
                className="text-xs font-medium text-brand-700 hover:text-brand-800 mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
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
