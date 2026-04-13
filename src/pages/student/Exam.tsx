import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useProctoring } from '../../hooks/useProctoring';
import { useEyeGazeDetection } from '../../hooks/useEyeGazeDetection';
import { useLivenessCheck } from '../../hooks/useLivenessCheck';
import { useExamSession } from '../../hooks/useExamSession';
import { useExamAnswers } from '../../hooks/useExamAnswers';
import { useViolationTracker } from '../../hooks/useViolationTracker';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { DistanceSetupModal } from '../../components/DistanceSetupModal';
import { ExamSubmissionModal } from '../../components/ExamSubmissionModal';
import { mockQuestions } from '../../data/mockData';
import { getRiskLevel, calculateViolationScore, ViolationEvent as LocalViolationEvent } from '../../utils/violationScorer';
import { ViolationType, ViolationSeverity } from '../../types/examSession';
import {
  Clock, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, CameraOff, Video, ArrowLeftRight
} from 'lucide-react';

export const Exam = () => {
  const navigate = useNavigate();
  const { currentExam, user } = useApp();
  
  // Memoize values that depend on currentExam to prevent unnecessary re-renders
  const currentExamId = currentExam?.id ? String(currentExam.id) : undefined;
  const currentExamDuration = currentExam?.duration ?? 90;

  // ── Phase 2: Session & Answer Management ──
  const {
    session,
    isLoading: sessionLoading,
    error: sessionError,
    startSession,
    submitExam,
    timeElapsed,
    startTimer,
    // stopTimer, // Currently unused - auto-submit disabled
  } = useExamSession();

  const totalQuestions = mockQuestions.length;
  const {
    answers,
    answeredCount,
    setCurrentQuestion: trackCurrentQuestion,
    selectAnswer,
    getSubmittedAnswers,
    syncToServer,
  } = useExamAnswers(totalQuestions);

  // ── Phase 3: Violation Tracking ──
  const {
    violations: trackedViolations,
    violationCount,
    recordViolation,
  } = useViolationTracker(
    session?.id,
    currentExamId,
    user?.id
  );

  // ── Submission Modal State ──
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // ── Legacy State (kept for proctoring) ──
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(5400);
  const [showLivenessCheck, setShowLivenessCheck] = useState(false);
  const [showDistanceSetup, setShowDistanceSetup] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<'center' | 'looking-away'>('center');
  const [criticalWarning, setCriticalWarning] = useState<{ message: string; severity: 'high' | 'critical' } | null>(null);

  // Distance standardization
  const [optimalDistanceCm, setOptimalDistanceCm] = useState<number | null>(null);

  // Violation scoring (local, for display warnings only)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_violationScore, setViolationScore] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [lastAlertTime, setLastAlertTime] = useState(0);

  const { status, videoRef: proctoringVideoRef, retryCamera } = useProctoring(examStarted);
  const {
    gazeData,
    isDetecting,
    modelsLoaded: gazeModelsLoaded,
    videoRef: gazeVideoRef,
    startDetection,
    stopDetection
  } = useEyeGazeDetection(examStarted);

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

  // Use liveness face distance before exam starts, then gaze distance after
  const faceDistanceCm = examStarted ? gazeData?.faceDistanceCm : livenessFaceDistanceCm;

  // ── Start eye gaze detection when exam starts ──
  useEffect(() => {
    if (examStarted && gazeModelsLoaded && status.camera && !isDetecting) {
      startDetection();
    }
  }, [examStarted, gazeModelsLoaded, status.camera, isDetecting, startDetection]);

  // ── Gaze status tracking ──
  useEffect(() => {
    if (gazeData?.isLookingAway) {
      setGazeStatus('looking-away');
    } else {
      setGazeStatus('center');
    }
  }, [gazeData?.isLookingAway, gazeData?.isBlinking]);

  // ── Violation Detection Effect - monitor gaze data for violations ──
  const lastViolationEventTimeRef = useRef<{ gaze_sustained: number; head_pose: number; gaze_brief: number }>({
    gaze_sustained: 0,
    head_pose: 0,
    gaze_brief: 0
  });
  
  // Use a ref to prevent infinite loops caused by gazeData updates
  const prevGazeDataRef = useRef<typeof gazeData | null>(null);

  useEffect(() => {
    if (!gazeData || !examStarted) return;
    
    // Skip if gaze data hasn't meaningfully changed
    if (prevGazeDataRef.current && 
        prevGazeDataRef.current.isLookingAway === gazeData.isLookingAway &&
        prevGazeDataRef.current.gazeDirection === gazeData.gazeDirection &&
        Math.abs(prevGazeDataRef.current.gazeDuration - gazeData.gazeDuration) < 100) {
      return;
    }
    
    prevGazeDataRef.current = gazeData;

    const now = Date.now();
    const SUSTAINED_DEBOUNCE = 5000;
    const BRIEF_DEBOUNCE = 3000;

    // Detect Sustained Look-Away (>3 seconds)
    if (gazeData.isLookingAway && gazeData.gazeDuration > 3000 &&
        now - lastViolationEventTimeRef.current.gaze_sustained > SUSTAINED_DEBOUNCE) {
      recordViolation({
        violation_type: 'gaze_sustained_away' as ViolationType,
        severity: 'high' as ViolationSeverity,
        occurred_at: new Date().toISOString(),
        duration_ms: gazeData.gazeDuration,
        description: `Looked away for ${Math.round(gazeData.gazeDuration / 1000)}s`,
        metadata: { direction: gazeData.gazeDirection },
      });
      lastViolationEventTimeRef.current.gaze_sustained = now;
    }

    // Detect Extreme Head Pose (yaw > 45 degrees)
    if (gazeData.headPose && Math.abs(gazeData.headPose.yaw) > 45 &&
        now - lastViolationEventTimeRef.current.head_pose > SUSTAINED_DEBOUNCE) {
      recordViolation({
        violation_type: 'head_pose_extreme' as ViolationType,
        severity: 'medium' as ViolationSeverity,
        occurred_at: new Date().toISOString(),
        description: `Head turned ${Math.round(gazeData.headPose.yaw)}°`,
        metadata: { pose: gazeData.headPose },
      });
      lastViolationEventTimeRef.current.head_pose = now;
    }

    // Detect brief look-away events (1-3 seconds)
    if (gazeData.isLookingAway && gazeData.gazeDuration > 1000 && gazeData.gazeDuration <= 3000 &&
        now - lastViolationEventTimeRef.current.gaze_brief > BRIEF_DEBOUNCE) {
      recordViolation({
        violation_type: 'gaze_looking_away' as ViolationType,
        severity: 'low' as ViolationSeverity,
        occurred_at: new Date().toISOString(),
        duration_ms: gazeData.gazeDuration,
        description: `Brief look away for ${Math.round(gazeData.gazeDuration / 1000)}s`,
        metadata: { direction: gazeData.gazeDirection },
      });
      lastViolationEventTimeRef.current.gaze_brief = now;
    }
  }, [gazeData, examStarted, recordViolation]);

  // ── Warning overlays ──
  useEffect(() => {
    if (violationCount === 0 || criticalWarning) return;

    const latestViolation = trackedViolations[trackedViolations.length - 1];
    if (latestViolation && (latestViolation.severity === 'high' || latestViolation.severity === 'critical')) {
      setCriticalWarning({
        message: latestViolation.description || 'Violation detected',
        severity: latestViolation.severity as 'high' | 'critical'
      });
      setTimeout(() => {
        setCriticalWarning(prev => (prev && prev.message === latestViolation.description ? null : prev));
      }, 3000);
    }
  }, [violationCount, trackedViolations]); // Removed criticalWarning from dependencies

  useEffect(() => {
    if (violationCount === 5 && !criticalWarning) {
      setCriticalWarning({ message: 'Multiple violations detected. Please keep your eyes on the exam.', severity: 'high' });
      setTimeout(() => setCriticalWarning(null), 5000);
    }
  }, [violationCount]); // Removed criticalWarning from dependencies

  useEffect(() => {
    if (violationCount === 10 && !criticalWarning) {
      setCriticalWarning({ message: '⚠️ Exam will be flagged if violations continue.', severity: 'critical' });
      setTimeout(() => setCriticalWarning(null), 5000);
    }
  }, [violationCount]); // Removed criticalWarning from dependencies

  // ── Violation scoring (local only for now) ──
  useEffect(() => {
    if (violationCount === 0 || !examStarted) return;

    // Convert tracked violations to local format for scoring
    const localViolations: LocalViolationEvent[] = trackedViolations.map(v => ({
      id: v.id,
      type: v.violation_type as any,
      severity: v.severity as any,
      timestamp: v.occurred_at,
      duration: v.duration_ms ?? undefined,
      description: v.description || '',
      metadata: v.metadata,
    }));

    const { score, level } = calculateViolationScore(localViolations);
    setViolationScore(score);
    setRiskLevel(level);
    const risk = getRiskLevel(score);
    if (risk.shouldAlert && Date.now() - lastAlertTime > 60000) {
      setLastAlertTime(Date.now());
    }
  }, [trackedViolations, violationCount, examStarted]); // Removed lastAlertTime from dependencies

  // ── Stop detection on unmount ──
  useEffect(() => {
    return () => { stopDetection(); };
  }, [stopDetection]);

  // ── Video refs ──
  const setCombinedVideoRef = useCallback((element: HTMLVideoElement | null) => {
    combinedVideoRef.current = element;
    proctoringVideoRef(element);
    gazeVideoRef(element);
  }, [proctoringVideoRef, gazeVideoRef]);

  const setLivenessVideoRef = useCallback((element: HTMLVideoElement | null) => {
    livenessVideoRef(element);
  }, [livenessVideoRef]);

  // ── Timer (sync with session timer) ──
  useEffect(() => {
    if (!examStarted) return;
    const duration = currentExamDuration * 60;
    const remaining = Math.max(0, duration - timeElapsed);
    setTimeRemaining(remaining);
  }, [timeElapsed, examStarted, currentExamDuration]);

  // ── Track current question for time tracking ──
  useEffect(() => {
    const q = mockQuestions[currentQuestion];
    if (q) {
      trackCurrentQuestion(String(q.id));
    }
  }, [currentQuestion, trackCurrentQuestion]);

  // ── Auto-sync answers when session is active ──
  useEffect(() => {
    if (session?.id && answeredCount > 0) {
      syncToServer(session.id);
    }
  }, [answeredCount, session?.id, syncToServer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Answer selection ──
  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    selectAnswer(String(questionId), answerIndex);
  };

  // ── Submission flow ──
  const handleSubmit = useCallback(() => {
    setShowSubmissionModal(true);
  }, []);

  const handleFinalSubmit = useCallback(async () => {
    if (!session) {
      console.error('[Exam] No active session to submit');
      navigate('/results');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setShowSubmissionModal(false);

    try {
      // Final answer sync
      await syncToServer(session.id);

      // Build submitted answers
      const submittedAnswers = getSubmittedAnswers();

      // Submit to server
      const result = await submitExam(submittedAnswers, timeElapsed);

      if (result.success) {
        navigate('/results', { state: { submissionResult: result } });
      } else {
        setSubmissionError(result.error ?? 'Submission failed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSubmissionError(message);
      setIsSubmitting(false);
      console.error('[Exam] Submission error:', err);
    }
  }, [session, syncToServer, getSubmittedAnswers, submitExam, timeElapsed, navigate]);

  const handleCancelSubmit = useCallback(() => {
    setShowSubmissionModal(false);
  }, []);

  // ── Liveness & Distance handlers ──
  const handleSetOptimalDistance = useCallback((distance: number) => {
    setOptimalDistanceCm(distance);
    setShowDistanceSetup(false);
    setShowLivenessCheck(true);
  }, []);

  const handleLivenessComplete = useCallback(async () => {
    if (livenessPassed && currentExam && user) {
      setShowLivenessCheck(false);
      setExamStarted(true);

      // Start the session in database
      const success = await startSession(
        String(currentExam.id),
        user.id,
        { liveness_check_passed: true }
      );

      if (!success) {
        console.error('[Exam] Failed to start session, continuing with local-only mode');
      }

      // Start the exam timer
      startTimer();
    }
  }, [livenessPassed, currentExam, user, startSession, startTimer]);

  const handleLivenessRetry = useCallback(() => {
    resetCheck();
    setTimeout(() => { startCheck(); }, 500);
  }, [resetCheck, startCheck]);

  // ── Redirect if no exam ──
  useEffect(() => {
    if (!currentExam && !sessionLoading) {
      navigate('/');
    }
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

  const question = mockQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100;

  // ── Distance setup modal ──
  if (showDistanceSetup) {
    return <DistanceSetupModal onComplete={handleSetOptimalDistance} />;
  }

  // ── Liveness check modal ──
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

  // ── Main Exam UI ──
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentExam.title}</h1>
              <p className="text-sm text-gray-500">
                Question {currentQuestion + 1} of {mockQuestions.length}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <Clock className="w-5 h-5 text-gray-700" />
              <span className={`text-lg font-mono font-semibold ${
                timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'
              }`}>
                {formatTime(timeRemaining)}
              </span>
              {/* Answer progress */}
              <span className="text-sm text-gray-500">
                {answeredCount}/{mockQuestions.length} answered
              </span>
            </div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                {question.question}
              </h2>
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(question.id, index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers.has(String(question.id)) && answers.get(String(question.id)) === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                        answers.has(String(question.id)) && answers.get(String(question.id)) === index
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {answers.has(String(question.id)) && answers.get(String(question.id)) === index && (
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

              {currentQuestion === mockQuestions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="flex items-center space-x-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Submit Exam</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestion(Math.min(mockQuestions.length - 1, currentQuestion + 1))}
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
              className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${
                status.camera ? 'opacity-100' : 'opacity-0'
              }`}
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
            {criticalWarning && (
              <div className="absolute top-2 left-2 right-2 z-20">
                <div className={`px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm ${
                  criticalWarning.severity === 'critical' ? 'bg-red-600/90' : 'bg-orange-600/90'
                }`}>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
                    <p className="text-white text-xs font-medium flex-1">{criticalWarning.message}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2">
              <div className={`w-3 h-3 rounded-full ${status.camera ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            </div>
          </div>

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
              isDetecting ? gazeStatus === 'looking-away' ? 'bg-red-50' : 'bg-green-50' : 'bg-gray-50'
            }`}>
              <span className={`text-sm font-medium ${
                isDetecting ? gazeStatus === 'looking-away' ? 'text-red-700' : 'text-green-700' : 'text-gray-500'
              }`}>
                {isDetecting ? 'Eye Gaze' : 'Gaze Detection'}
              </span>
              {isDetecting ? (
                gazeStatus === 'looking-away' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Distance Indicator */}
            {examStarted && faceDistanceCm && optimalDistanceCm && (
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <ArrowLeftRight className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Distance</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-gray-900">~{faceDistanceCm}cm</span>
                    {Math.abs(faceDistanceCm - optimalDistanceCm) > 15 && (
                      <AlertTriangle className="w-3 h-3 text-orange-500 animate-pulse" />
                    )}
                  </div>
                </div>
                <div className="mt-1 relative h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    Math.abs(faceDistanceCm - optimalDistanceCm) > 15 ? 'bg-orange-400' : 'bg-green-400'
                  }`} style={{ width: `${Math.max(10, Math.min(90, (faceDistanceCm / 100) * 100))}%` }} />
                </div>
              </div>
            )}

            {/* Session Status */}
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
            {mockQuestions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`p-3 rounded-lg text-sm font-medium transition-all ${
                  currentQuestion === index
                    ? 'bg-blue-600 text-white'
                    : answers.has(String(q.id))
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2 text-xs text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-600 rounded" />
              <span>Current</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
              <span>Answered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-100 rounded" />
              <span>Not Answered</span>
            </div>
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

      {/* Submission Modal */}
      <ExamSubmissionModal
        isOpen={showSubmissionModal}
        totalQuestions={mockQuestions.length}
        answeredCount={answeredCount}
        timeElapsed={timeElapsed}
        isSubmitting={isSubmitting}
        onConfirm={handleFinalSubmit}
        onCancel={handleCancelSubmit}
      />
    </div>
  );
};
