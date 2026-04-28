import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useProctoring } from '../../hooks/useProctoring';
import { useGazeTracking } from '../../hooks/useGazeTracking';
import { useLivenessCheck } from '../../hooks/useLivenessCheck';
import { useExamSession } from '../../hooks/useExamSession';
import { useExamAnswers } from '../../hooks/useExamAnswers';
import { useViolationTracker } from '../../hooks/useViolationTracker';
import { useTabFocusTracker } from '../../hooks/useTabFocusTracker';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { DistanceSetupModal } from '../../components/DistanceSetupModal';
import { ExamSubmissionModal } from '../../components/ExamSubmissionModal';
import { IdentityVerificationService, type StartSessionResponse, type JoinExamResponse } from '../../services/IdentityVerificationService';
import { DistanceCalibrationService } from '../../services/DistanceCalibrationService';
import { CheatingScoreTracker } from '../../services/CheatingScoreService';
import type { ProctoringPolicy } from '../../types/examSession';

interface ExamQuestion {
  id: string;
  position: number;
  type: string;
  prompt: string;
  options: string[];
  points: number;
}
import {
  Clock, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, CameraOff, Video, ArrowLeftRight, ShieldAlert
} from 'lucide-react';

const DEFAULT_POLICY = {
  visual_evidence_allowed: true,
  warning_threshold: 40,
  critical_threshold: 70,
  critical_sustain_seconds: 10,
  max_verification_attempts: 3,
  gaze_config: {
    peripheral_max_cumulative_min: 30,
    away_max_continuous_s: 3,
  },
};

export const Exam = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const locationState = location.state as { sessionData?: StartSessionResponse; joinData?: JoinExamResponse } | null;
  const { currentExam, user } = useApp();

  const currentExamId = currentExam?.id ? String(currentExam.id) : undefined;
  const currentExamDuration = currentExam?.duration ?? 90;
  const currentPolicy: ProctoringPolicy =
    (locationState?.joinData?.exam?.proctoring_policy as ProctoringPolicy | undefined) ??
    (currentExam?.proctoring_policy as ProctoringPolicy | undefined) ??
    DEFAULT_POLICY;

  // Real questions from DB — seeded from navigation state, fetched otherwise
  const [questions, setQuestions] = useState<ExamQuestion[]>(
    () => (locationState?.sessionData?.questions as ExamQuestion[]) ?? []
  );

  // Score tracker is stable for the exam lifetime
  const scoreTracker = useMemo(() => new CheatingScoreTracker(DEFAULT_POLICY), []);

  // ── Phase 2: Session & Answer Management ──
  const {
    session,
    isLoading: sessionLoading,
    error: sessionError,
    submitExam,
    timeElapsed,
    startTimer,
  } = useExamSession();

  const totalQuestions = questions.length;
  const {
    answers,
    answeredCount,
    setCurrentQuestion: trackCurrentQuestion,
    selectAnswer,
    getSubmittedAnswers,
    syncToServer,
  } = useExamAnswers(totalQuestions);

  // ── Phase 5: Violation Tracking with authoritative score ──
  const {
    violations: trackedViolations,
    violationCount,
    recordViolation,
    liveScore,
    warningThresholdCrossed,
    criticalThresholdCrossed,
  } = useViolationTracker(session?.id, currentExamId, user?.id, scoreTracker);

  // ── Submission Modal State ──
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // ── UI State ──
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(5400);
  const [showLivenessCheck, setShowLivenessCheck] = useState(false);
  const [showDistanceSetup, setShowDistanceSetup] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<'center' | 'looking-away'>('center');

  // T062: Graduated non-blocking warning state
  const [warningBanner, setWarningBanner] = useState<{
    message: string;
    level: 'info' | 'warning' | 'critical';
  } | null>(null);

  const [sessionCalibration, setSessionCalibration] = useState<{
    optimal_distance_cm: number;
    distance_tolerance_cm: number;
    calibration_skipped: boolean;
  } | null>(null);

  const { status, videoRef: proctoringVideoRef, retryCamera, setCanonicalViolationCallback, captureViolationSnapshot } = useProctoring(
    examStarted,
    sessionCalibration?.optimal_distance_cm,
    sessionCalibration?.distance_tolerance_cm
  );

  const {
    isRunning: gazeRunning,
    modelsLoaded: gazeModelsLoaded,
    currentSample: gazeSample,
    currentZone: gazeZone,
    start: startGazeTracking,
    videoRef: gazeVideoRef
  } = useGazeTracking({
    sensitivity: 'medium',
    enableCalibration: false,
    enableWarnings: true,
    proctoringPolicy: currentPolicy,
    onCanonicalViolation: (v) => {
      if (!session?.id || !examStarted) return;
      const persistedType = v.type === 'gaze_peripheral' ? 'gaze_looking_away' : 'gaze_prolonged_away';
      recordViolation({
        violation_type: persistedType,
        severity: v.severity,
        occurred_at: v.client_captured_at,
        duration_ms: v.duration_ms,
        description: v.description,
        metadata: {
          ...v.metadata,
          emitted_type: v.type,
        } as Record<string, unknown>,
        client_event_id: '',
        type: persistedType,
        client_captured_at: v.client_captured_at,
      });
    },
  });

  const {
    isChecking,
    isPassed: livenessPassed,
    isFailed: livenessFailed,
    progress: livenessProgress,
    instruction,
    currentStep,
    stepIndex,
    totalSteps,
    startCheck,
    resetCheck,
    videoRef: livenessVideoRef,
    faceDistanceCm: livenessFaceDistanceCm
  } = useLivenessCheck();

  const combinedVideoRef = useRef<HTMLVideoElement | null>(null);

  const gazeDistanceCm = gazeSample ? Math.round(30 + (1 - gazeSample.faceDistance) * 70) : null;
  const faceDistanceCm = examStarted ? gazeDistanceCm : livenessFaceDistanceCm;

  // T059: Tab focus tracking
  useTabFocusTracker({
    enabled: examStarted,
    onViolation: (v) => {
      if (!session?.id) return;
      recordViolation({
        violation_type: v.type,
        severity: v.severity,
        occurred_at: v.client_captured_at,
        duration_ms: v.duration_ms ?? undefined,
        description: `Tab lost focus (${v.metadata.reason})`,
        metadata: v.metadata as Record<string, unknown>,
        client_event_id: '',
        type: v.type,
        client_captured_at: v.client_captured_at,
      });
    },
  });

  // ── Wire canonical proctoring violations ──
  useEffect(() => {
    if (!examStarted || !session?.id) return;

    setCanonicalViolationCallback(async (v) => {
      let evidenceImage: string | null = null;
      if (v.severity >= 20) {
        evidenceImage = await captureViolationSnapshot();
      }
      recordViolation({
        violation_type: v.type,
        severity: v.severity,
        occurred_at: v.client_captured_at,
        description: v.description,
        evidence_image: evidenceImage,
        metadata: v.metadata ?? {},
        client_event_id: '',
        type: v.type,
        client_captured_at: v.client_captured_at,
      });
    });
  }, [examStarted, session?.id, setCanonicalViolationCallback, captureViolationSnapshot, recordViolation]);

  // ── Start gaze tracking when exam starts ──
  useEffect(() => {
    if (examStarted && gazeModelsLoaded && status.camera && !gazeRunning) {
      startGazeTracking();
    }
  }, [examStarted, gazeModelsLoaded, status.camera, gazeRunning, startGazeTracking]);

  // ── Gaze status tracking ──
  useEffect(() => {
    setGazeStatus(gazeZone === 'on_screen' ? 'center' : 'looking-away');
  }, [gazeZone]);

  // T062: Graduated non-blocking warnings based on authoritative score
  useEffect(() => {
    if (!examStarted) return;

    if (criticalThresholdCrossed) {
      setWarningBanner({
        message: `⚠️ Critical alert: monitoring score ${Math.round(liveScore)}. Your instructor has been notified.`,
        level: 'critical',
      });
    } else if (warningThresholdCrossed) {
      setWarningBanner({
        message: `Attention notice: please keep your eyes on the exam (score: ${Math.round(liveScore)}).`,
        level: 'warning',
      });
    } else if (liveScore === 0) {
      setWarningBanner(null);
    }
  }, [liveScore, warningThresholdCrossed, criticalThresholdCrossed, examStarted]);

  // T062: Per-event non-blocking warning for severity >= 10
  useEffect(() => {
    if (!examStarted || violationCount === 0) return;
    const latest = trackedViolations[trackedViolations.length - 1];
    if (!latest) return;
    const sev = typeof latest.severity === 'number' ? latest.severity : 0;
    if (sev >= 10) {
      setWarningBanner(prev => prev?.level === 'critical' ? prev : {
        message: latest.description || 'Proctoring violation detected.',
        level: sev >= 20 ? 'critical' : 'warning',
      });
      setTimeout(() => {
        setWarningBanner(prev => {
          if (!prev || prev.message === (latest.description || 'Proctoring violation detected.')) return null;
          return prev;
        });
      }, 4000);
    }
  }, [violationCount, trackedViolations, examStarted]);

  // ── Video refs ──
  const setCombinedVideoRef = useCallback((element: HTMLVideoElement | null) => {
    combinedVideoRef.current = element;
    proctoringVideoRef(element);
    gazeVideoRef(element);
  }, [proctoringVideoRef, gazeVideoRef]);

  const setLivenessVideoRef = useCallback((element: HTMLVideoElement | null) => {
    livenessVideoRef(element);
  }, [livenessVideoRef]);

  // ── Timer ──
  useEffect(() => {
    if (!examStarted) return;
    const duration = currentExamDuration * 60;
    setTimeRemaining(Math.max(0, duration - timeElapsed));
  }, [timeElapsed, examStarted, currentExamDuration]);

  // ── Track current question ──
  useEffect(() => {
    const q = questions[currentQuestion];
    if (q) trackCurrentQuestion(q.id);
  }, [currentQuestion, trackCurrentQuestion]);

  // ── Auto-sync answers ──
  useEffect(() => {
    if (session?.id && answeredCount > 0) syncToServer(session.id);
  }, [answeredCount, session?.id, syncToServer]);

  // Fetch questions via idempotent RPC when missing (continue-exam flow)
  useEffect(() => {
    const sid = session?.id ?? sessionId;
    if (!examStarted || !sid || questions.length > 0) return;
    IdentityVerificationService.startSession(sid, DistanceCalibrationService.asSkipped()).then(result => {
      if (result.success && result.data?.questions?.length) {
        setQuestions(result.data.questions as ExamQuestion[]);
        if (!sessionCalibration && result.data.session) {
          const cal = result.data.session;
          setSessionCalibration({
            optimal_distance_cm: cal.optimal_distance_cm,
            distance_tolerance_cm: cal.distance_tolerance_cm,
            calibration_skipped: cal.calibration_skipped,
          });
        }
      }
    });
  }, [examStarted, session?.id, sessionId, questions.length]);

  // T064: Camera lifecycle cleanup on unmount / navigation
  useEffect(() => {
    return () => {
      // Camera cleanup is handled by useProctoring's cleanup effect.
      // Explicit stream cleanup here ensures no dangling tracks on navigate.
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    selectAnswer(questionId, answerIndex);
  };

  const handleSubmit = useCallback(() => setShowSubmissionModal(true), []);

  const handleFinalSubmit = useCallback(async () => {
    if (!session) {
      navigate('/results');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setShowSubmissionModal(false);

    try {
      await syncToServer(session.id);
      const submittedAnswers = getSubmittedAnswers();
      const result = await submitExam(submittedAnswers, timeElapsed);

      if (result.success) {
        navigate('/results', { state: { submissionResult: result } });
      } else {
        setSubmissionError(result.error ?? 'Submission failed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'Unknown error');
      setIsSubmitting(false);
    }
  }, [session, syncToServer, getSubmittedAnswers, submitExam, timeElapsed, navigate]);

  const handleCancelSubmit = useCallback(() => setShowSubmissionModal(false), []);

  const handleSetOptimalDistance = useCallback(async (distance: number) => {
    const sid = sessionId;
    if (sid) {
      const calibPayload = DistanceCalibrationService.fromCalibratedDistance(distance);
      let result = await DistanceCalibrationService.submitCalibration(sid, calibPayload);
      if (!result.success) {
        result = await DistanceCalibrationService.submitCalibration(sid, DistanceCalibrationService.asSkipped());
      }
      if (result.success && result.data) {
        const cal = result.data.session;
        setSessionCalibration({
          optimal_distance_cm: cal.optimal_distance_cm,
          distance_tolerance_cm: cal.distance_tolerance_cm,
          calibration_skipped: cal.calibration_skipped,
        });
        if (result.data.questions?.length) {
          setQuestions(result.data.questions as ExamQuestion[]);
        }
      }
    }
    setShowDistanceSetup(false);
    setShowLivenessCheck(true);
  }, [sessionId]);

  const handleLivenessComplete = useCallback(async () => {
    if (livenessPassed) {
      setShowLivenessCheck(false);
      setExamStarted(true);
      startTimer();
    }
  }, [livenessPassed, startTimer]);

  const handleLivenessRetry = useCallback(() => {
    resetCheck();
    setTimeout(() => startCheck(), 500);
  }, [resetCheck, startCheck]);

  useEffect(() => {
    if (!currentExam && !sessionLoading) navigate('/');
  }, [currentExam, sessionLoading, navigate]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading exam session...</p>
        </div>
      </div>
    );
  }

  if (!currentExam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No exam selected</h1>
          <p className="text-gray-600 mb-4">Please navigate from the home page and select an exam.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion] ?? null;
  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;

  // Show spinner while questions load after exam starts
  if (examStarted && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading exam questions...</p>
        </div>
      </div>
    );
  }

  if (showDistanceSetup) return <DistanceSetupModal onComplete={handleSetOptimalDistance} />;

  if (showLivenessCheck) {
    return (
      <LivenessCheckModal
        isOpen={showLivenessCheck}
        isChecking={isChecking}
        isPassed={livenessPassed}
        isFailed={livenessFailed}
        progress={livenessProgress}
        instruction={instruction}
        currentStep={currentStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        videoRef={setLivenessVideoRef}
        onStartCheck={startCheck}
        onRetry={handleLivenessRetry}
        onContinue={handleLivenessComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col">
        {/* T062: Graduated non-blocking warning banner */}
        {warningBanner && (
          <div className={`px-6 py-2 flex items-center gap-3 text-sm font-medium ${
            warningBanner.level === 'critical'
              ? 'bg-red-600 text-white'
              : warningBanner.level === 'warning'
              ? 'bg-amber-500 text-white'
              : 'bg-blue-500 text-white'
          }`}>
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{warningBanner.message}</span>
            <button
              onClick={() => setWarningBanner(null)}
              className="ml-auto opacity-70 hover:opacity-100 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentExam.title}</h1>
              <p className="text-sm text-gray-500">Question {currentQuestion + 1} of {questions.length}</p>
            </div>
            <div className="flex items-center space-x-6">
              <Clock className="w-5 h-5 text-gray-700" />
              <span className={`text-lg font-mono font-semibold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                {formatTime(timeRemaining)}
              </span>
              <span className="text-sm text-gray-500">{answeredCount}/{questions.length} answered</span>
            </div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">{question.prompt}</h2>
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(question.id, index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers.has(question.id) && answers.get(question.id) === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                        answers.has(question.id) && answers.get(question.id) === index
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {answers.has(question.id) && answers.get(question.id) === index && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-gray-700">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {currentQuestion === questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="flex items-center space-x-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Submit Exam</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))}
                  className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="max-w-5xl mx-auto">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Proctoring Sidebar */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Monitor</h3>

          {/* Video Container */}
          <div className="rounded-lg aspect-video mb-4 bg-black relative overflow-hidden">
            <video
              ref={setCombinedVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${status.camera ? 'opacity-100' : 'opacity-0'}`}
            />
            {status.loading && !status.errorMessage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <Video className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm">Initializing camera...</p>
                </div>
              </div>
            )}
            {status.errorMessage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white p-4">
                  <CameraOff className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-sm mb-4">{status.errorMessage}</p>
                  <button onClick={retryCamera} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Retry</button>
                </div>
              </div>
            )}
            {!status.camera && !status.loading && !status.errorMessage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CameraOff className="w-12 h-12 text-gray-400" />
              </div>
            )}
            {status.multipleFaces && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center animate-pulse">
                <div className="bg-red-600 text-white px-4 py-2 rounded font-bold">Multiple Faces!</div>
              </div>
            )}
            <div className="absolute top-2 right-2">
              <div className={`w-3 h-3 rounded-full ${status.camera ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            </div>
          </div>

          {/* T062: Live score indicator */}
          {examStarted && liveScore > 0 && (
            <div className={`mb-3 p-2 rounded-lg border text-sm font-medium flex items-center justify-between ${
              criticalThresholdCrossed ? 'bg-red-50 border-red-200 text-red-700'
              : warningThresholdCrossed ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}>
              <span>Monitoring Score</span>
              <span className="font-mono font-bold">{Math.round(liveScore)}</span>
            </div>
          )}

          {/* Status Indicators */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg ${status.camera ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className={`text-sm font-medium ${status.camera ? 'text-green-700' : 'text-red-700'}`}>Camera</span>
              {status.camera ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              status.modelsLoaded ? status.faceDetected ? 'bg-green-50' : 'bg-yellow-50' : 'bg-gray-50'
            }`}>
              <span className={`text-sm font-medium ${
                status.modelsLoaded ? status.faceDetected ? 'text-green-700' : 'text-yellow-700' : 'text-gray-500'
              }`}>
                {status.modelsLoaded ? 'Face Detection' : 'Loading Models...'}
              </span>
              {status.modelsLoaded ? (
                status.faceDetected ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-yellow-600" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg ${status.tabActive ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className={`text-sm font-medium ${status.tabActive ? 'text-green-700' : 'text-red-700'}`}>Tab Status</span>
              {status.tabActive ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              gazeRunning ? gazeStatus === 'looking-away' ? 'bg-red-50' : 'bg-green-50' : 'bg-gray-50'
            }`}>
              <span className={`text-sm font-medium ${
                gazeRunning ? gazeStatus === 'looking-away' ? 'text-red-700' : 'text-green-700' : 'text-gray-500'
              }`}>
                {gazeRunning ? 'Eye Gaze' : 'Gaze Detection'}
              </span>
              {gazeRunning ? (
                gazeStatus === 'looking-away' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Distance Indicator */}
            {examStarted && faceDistanceCm && sessionCalibration?.optimal_distance_cm && (
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <ArrowLeftRight className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Distance</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-gray-900">~{faceDistanceCm}cm</span>
                    {Math.abs(faceDistanceCm - sessionCalibration.optimal_distance_cm) > 15 && (
                      <AlertTriangle className="w-3 h-3 text-orange-500 animate-pulse" />
                    )}
                  </div>
                </div>
                <div className="mt-1 relative h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${Math.abs(faceDistanceCm - sessionCalibration.optimal_distance_cm) > 15 ? 'bg-orange-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.max(10, Math.min(90, (faceDistanceCm / 100) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {session && (
              <div className="p-2 rounded bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-700 font-medium">Session Active</span>
                  <CheckCircle className="w-3 h-3 text-green-600" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question Navigator */}
        <div className="p-6 flex-1 overflow-auto">
          <h4 className="font-semibold text-gray-900 mb-4">Question Navigator</h4>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`p-3 rounded-lg text-sm font-medium transition-all ${
                  currentQuestion === index
                    ? 'bg-blue-600 text-white'
                    : answers.has(q.id)
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2 text-xs text-gray-500">
            <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-blue-600 rounded" /><span>Current</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded" /><span>Answered</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-gray-100 rounded" /><span>Not Answered</span></div>
          </div>
        </div>
      </div>

      {/* Session Error Banner */}
      {sessionError && (
        <div className="fixed bottom-4 right-4 z-40 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <p className="text-sm font-medium">Session Error</p>
          <p className="text-xs mt-1">{sessionError}</p>
        </div>
      )}

      {/* Submission Error Banner */}
      {submissionError && (
        <div className="fixed bottom-4 right-4 z-40 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <p className="text-sm font-medium">Submission Failed</p>
          <p className="text-xs mt-1">{submissionError}</p>
          <button onClick={() => setSubmissionError(null)} className="text-xs underline mt-2">Dismiss</button>
        </div>
      )}

      <ExamSubmissionModal
        isOpen={showSubmissionModal}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        timeElapsed={timeElapsed}
        isSubmitting={isSubmitting}
        onConfirm={handleFinalSubmit}
        onCancel={handleCancelSubmit}
      />
    </div>
  );
};
