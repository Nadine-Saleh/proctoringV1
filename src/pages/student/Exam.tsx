import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useProctoring } from '../../hooks/useProctoring';
import { useEyeGazeDetection } from '../../hooks/useEyeGazeDetection';
import { useLivenessCheck } from '../../hooks/useLivenessCheck';
import { useMicrophoneContext } from '../../context/MicrophoneContext';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { DistanceSetupModal } from '../../components/DistanceSetupModal';
import { MicrophonePermissionModal } from '../../components/MicrophonePermissionModal';
import { mockQuestions } from '../../data/mockData';
import { calculateViolationScore, getRiskLevel, ViolationEvent } from '../../utils/violationScorer';
import { sendCriticalAlert } from '../../services/instructorAlertService';
import {
  Clock, AlertTriangle, CheckCircle, MicOff,
  ChevronLeft, ChevronRight, CameraOff, Video, ArrowLeftRight
} from 'lucide-react';

export const Exam = () => {
  const navigate = useNavigate();
  const { currentExam } = useApp();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [timeRemaining, setTimeRemaining] = useState(5400);
  const [showLivenessCheck, setShowLivenessCheck] = useState(false);
  const [showDistanceSetup, setShowDistanceSetup] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<'center' | 'looking-away'>('center');
  const [criticalWarning, setCriticalWarning] = useState<{ message: string; severity: 'high' | 'critical' } | null>(null);

  // LocalStorage persistence for mandatory modal sequence
  const STORAGE_KEYS = {
    STEPS_PREFIX: 'proctoring_steps_',
    EXAM_ID: 'current_exam_id'
  } as const;

  const getStoredSteps = useCallback((examId: string) => {
    try {
      const key = `${STORAGE_KEYS.STEPS_PREFIX}${examId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as Record<'distance' | 'liveness' | 'microphone', boolean> : {} as Record<'distance' | 'liveness' | 'microphone', boolean>;
    } catch {
      return {} as Record<'distance' | 'liveness' | 'microphone', boolean>;
    }
  }, []);

  const setStepCompleted = useCallback((examId: string, step: 'distance' | 'liveness' | 'microphone') => {
    try {
      const key = `${STORAGE_KEYS.STEPS_PREFIX}${examId}`;
      const steps = getStoredSteps(examId);
      steps[step] = true;
      localStorage.setItem(key, JSON.stringify(steps));
      localStorage.setItem(STORAGE_KEYS.EXAM_ID, examId);
    } catch (e) {
      console.warn('[Exam] Failed to save step:', step, e);
    }
  }, [getStoredSteps]);

  const clearStoredSteps = useCallback((examId: string) => {
    try {
      const key = `${STORAGE_KEYS.STEPS_PREFIX}${examId}`;
      localStorage.removeItem(key);
      localStorage.removeItem(STORAGE_KEYS.EXAM_ID);
    } catch (e) {
      console.warn('[Exam] Failed to clear storage:', e);
    }
  }, []);

  // Distance standardization
  const [optimalDistanceCm, setOptimalDistanceCm] = useState<number | null>(null);

  // Violation tracking state (hidden from student - only sent to instructor)
  const [violationEvents, setViolationEvents] = useState<ViolationEvent[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_violationScore, setViolationScore] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [lastAlertTime, setLastAlertTime] = useState(0);

  const { status, videoRef: proctoringVideoRef, retryCamera } = useProctoring(examStarted);
  const {
    status: micStatus,
    isRecording,
    isStreamReady,
    streamHealthy: micStreamHealthy
  } = useMicrophoneContext();
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

  // Start eye gaze detection when exam starts and models are loaded
  useEffect(() => {
    if (examStarted && gazeModelsLoaded && status.camera && !isDetecting) {
      startDetection();
    }
  }, [examStarted, gazeModelsLoaded, status.camera, isDetecting, startDetection]);

  // Show subtle status change when looking away (no distracting overlays)
  useEffect(() => {
    if (gazeData?.isLookingAway) {
      setGazeStatus('looking-away');
    } else {
      setGazeStatus('center');
    }
  }, [gazeData?.isLookingAway, gazeData?.isBlinking]);

  // Violation Detection Effect - monitor gaze data for violations
  const lastViolationEventTimeRef = useRef<{ gaze_sustained: number; head_pose: number; gaze_brief: number }>({
    gaze_sustained: 0,
    head_pose: 0,
    gaze_brief: 0
  });

  useEffect(() => {
    if (!gazeData || !examStarted) return;

    const newEvents: ViolationEvent[] = [];
    const now = Date.now();

    // Debounce: only record events every 5 seconds for sustained, 3 seconds for others
    const SUSTAINED_DEBOUNCE = 5000;
    const BRIEF_DEBOUNCE = 3000;

    // Detect Sustained Look-Away (>3 seconds)
    if (gazeData.isLookingAway && gazeData.gazeDuration > 3000 &&
        now - lastViolationEventTimeRef.current.gaze_sustained > SUSTAINED_DEBOUNCE) {
      newEvents.push({
        id: `gaze_${Date.now()}`,
        type: 'gaze_sustained_away',
        severity: 'high',
        timestamp: new Date().toISOString(),
        duration: gazeData.gazeDuration,
        description: `Looked away for ${Math.round(gazeData.gazeDuration / 1000)}s`,
        metadata: { direction: gazeData.gazeDirection }
      });
      lastViolationEventTimeRef.current.gaze_sustained = now;
    }

    // Detect Extreme Head Pose (yaw > 45 degrees)
    if (gazeData.headPose && Math.abs(gazeData.headPose.yaw) > 45 &&
        now - lastViolationEventTimeRef.current.head_pose > SUSTAINED_DEBOUNCE) {
      newEvents.push({
        id: `head_${Date.now()}`,
        type: 'head_pose_extreme',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        description: `Head turned ${Math.round(gazeData.headPose.yaw)}°`,
        metadata: { pose: gazeData.headPose }
      });
      lastViolationEventTimeRef.current.head_pose = now;
    }

    // Detect brief look-away events (1-3 seconds)
    if (gazeData.isLookingAway && gazeData.gazeDuration > 1000 && gazeData.gazeDuration <= 3000 &&
        now - lastViolationEventTimeRef.current.gaze_brief > BRIEF_DEBOUNCE) {
      newEvents.push({
        id: `gaze_brief_${Date.now()}`,
        type: 'gaze_looking_away',
        severity: 'low',
        timestamp: new Date().toISOString(),
        duration: gazeData.gazeDuration,
        description: `Brief look away for ${Math.round(gazeData.gazeDuration / 1000)}s`,
        metadata: { direction: gazeData.gazeDirection }
      });
      lastViolationEventTimeRef.current.gaze_brief = now;
    }

    if (newEvents.length > 0) {
      setViolationEvents(prev => [...prev, ...newEvents].slice(-50)); // Keep last 50 events
    }
  }, [gazeData, examStarted]);

  // Show critical warning alert for high/critical violations
  useEffect(() => {
    if (violationEvents.length === 0 || criticalWarning) return;

    const latestEvent = violationEvents[violationEvents.length - 1];
    const isHighOrCritical = latestEvent.severity === 'high' || latestEvent.severity === 'medium';

    if (isHighOrCritical) {
      setCriticalWarning({
        message: latestEvent.description,
        severity: latestEvent.severity as 'high' | 'critical'
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setCriticalWarning(prev => {
          // Only clear if it's still the same warning
          if (prev && prev.message === latestEvent.description) {
            return null;
          }
          return prev;
        });
      }, 3000);
    }
  }, [violationEvents.length]);

  // Show warning after 5 violations
  useEffect(() => {
    if (violationEvents.length === 5 && !criticalWarning) {
      setCriticalWarning({
        message: 'Multiple violations detected. Please keep your eyes on the exam.',
        severity: 'high'
      });

      setTimeout(() => {
        setCriticalWarning(null);
      }, 5000);
    }
  }, [violationEvents.length, criticalWarning]);

  // Show stronger warning after 10 violations
  useEffect(() => {
    if (violationEvents.length === 10 && !criticalWarning) {
      setCriticalWarning({
        message: '⚠️ Exam will be flagged if violations continue.',
        severity: 'critical'
      });

      setTimeout(() => {
        setCriticalWarning(null);
      }, 5000);
    }
  }, [violationEvents.length, criticalWarning]);

  // Scoring & Alerting Effect
  useEffect(() => {
    if (violationEvents.length === 0 && !examStarted) return;

    const { score, level } = calculateViolationScore(violationEvents);
    setViolationScore(score);
    setRiskLevel(level);

    const risk = getRiskLevel(score);
    if (risk.shouldAlert && Date.now() - lastAlertTime > 60000) {
      // TODO: Replace with actual user ID from auth context
      const studentId = `student_${currentExam?.id || 'unknown'}`;
      
      sendCriticalAlert({
        examId: currentExam?.id || '',
        studentId,
        violationScore: score,
        events: violationEvents.slice(-10),
      }).then((result) => {
        if (result.success) {
          setLastAlertTime(Date.now());
          console.log('[Exam] Critical alert sent successfully:', result.alertId);
        } else {
          console.warn('[Exam] Alert not sent:', result.alertId);
        }
      }).catch((error) => {
        console.error('[Exam] Failed to send critical alert:', error);
      });
    }
  }, [violationEvents, currentExam, lastAlertTime, examStarted]);

  // Stop detection on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  // Combined video ref for both proctoring and eye gaze
  const setCombinedVideoRef = useCallback((element: HTMLVideoElement | null) => {
    combinedVideoRef.current = element;
    proctoringVideoRef(element);
    gazeVideoRef(element);
  }, [proctoringVideoRef, gazeVideoRef]);

  // Separate ref just for liveness check modal
  const setLivenessVideoRef = useCallback((element: HTMLVideoElement | null) => {
    livenessVideoRef(element);
  }, [livenessVideoRef]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    setAnswers({ ...answers, [questionId]: answerIndex });
  };

  const handleSubmit = useCallback(() => {
    if (currentExam?.id) {
      clearStoredSteps(currentExam.id);
    }
    navigate('/results');
  }, [navigate, currentExam, clearStoredSteps]);

  const handleSetOptimalDistance = useCallback((distance: number) => {
    setOptimalDistanceCm(distance);
    setStepCompleted(currentExam!.id, 'distance');
    setShowDistanceSetup(false);
    setShowLivenessCheck(true);
    console.log(`[Exam] ✓ Distance set to: ${distance}cm, moving to liveness check`);
  }, [currentExam, setStepCompleted]);

  const [showMicrophonePermission, setShowMicrophonePermission] = useState(false);

  const handleLivenessComplete = useCallback(() => {
    // Only allow exam start if liveness check passed, show mic permission next
    if (livenessPassed) {
      setStepCompleted(currentExam!.id, 'liveness');
      setShowLivenessCheck(false);
      setShowMicrophonePermission(true);
    }
  }, [livenessPassed, currentExam, setStepCompleted]);

  const handleMicrophoneComplete = useCallback(() => {
    console.log('[Exam] Microphone complete triggered - starting exam');
    setStepCompleted(currentExam!.id, 'microphone');
    setShowMicrophonePermission(false);
    setExamStarted(true);
  }, [currentExam, setStepCompleted]);

  const handleLivenessRetry = useCallback(() => {
    resetCheck();
    setTimeout(() => {
      startCheck();
    }, 500);
  }, [resetCheck, startCheck]);

  // Timer
  useEffect(() => {
    if (!currentExam) {
      navigate('/');
      return;
    }

    if (!examStarted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentExam, navigate, examStarted, handleSubmit]);

  // Restore modal states from storage on mount/refresh
  useEffect(() => {
    if (!currentExam?.id) return;

    const storedExamId = localStorage.getItem(STORAGE_KEYS.EXAM_ID);
    if (storedExamId !== currentExam.id) {
      // New/different exam - clear old storage
      clearStoredSteps(storedExamId || '');
      return;
    }

    const steps = getStoredSteps(currentExam.id);

    if (steps.microphone) {
      // All steps complete - start exam directly
      setShowDistanceSetup(false);
      setShowLivenessCheck(false);
      setShowMicrophonePermission(false);
      setExamStarted(true);
      console.log('[Exam] Restored: All steps complete, exam started');
    } else if (steps.liveness) {
      // Liveness done, need mic
      setShowDistanceSetup(false);
      setShowLivenessCheck(false);
      setShowMicrophonePermission(true);
      console.log('[Exam] Restored: Need microphone permission');
    } else if (steps.distance) {
      // Distance done, need liveness
      setShowDistanceSetup(false);
      setShowLivenessCheck(true);
      console.log('[Exam] Restored: Need liveness check');
    } else {
      // Start from beginning
      setShowDistanceSetup(true);
      console.log('[Exam] Restored: Start from distance setup');
    }
  }, [currentExam?.id, getStoredSteps, clearStoredSteps]);

  // Show "no exam" state if navigating directly to /exam
  if (!currentExam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No exam selected</h1>
          <p className="text-gray-600 mb-4">Please navigate from the home page and select an exam.</p>
          <button
            onClick={() => { navigate('/'); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const question = mockQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100;

  // Distance setup modal (first step)
  if (showDistanceSetup) {
    return <DistanceSetupModal onComplete={handleSetOptimalDistance} />;
  }

  // Show liveness check modal (second step)
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

  // Show microphone permission modal (third step - mandatory before exam)
  if (showMicrophonePermission) {
    return (
      <MicrophonePermissionModal
        isOpen={showMicrophonePermission}
        onComplete={handleMicrophoneComplete}
      />
    );
  }

  // Compute mic status after all explicit flow modals (hooks run always)
  const isMicActive = micStatus.microphone && isRecording && isStreamReady && micStreamHealthy;

  // Mic lost during exam - show recovery warning
  const showMicWarning = examStarted && !isMicActive;

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
              <span className="text-lg font-mono font-semibold text-gray-700">
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Microphone Warning Banner */}
        {showMicWarning && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 my-4">
            <div className="flex items-center">
              <MicOff className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Microphone connection lost. Please check your microphone and refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}

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
                      answers[question.id] === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                          answers[question.id] === index
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {answers[question.id] === index && (
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
                  onClick={() =>
                    setCurrentQuestion(Math.min(mockQuestions.length - 1, currentQuestion + 1))
                  }
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
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
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
                  <button
                    onClick={retryCamera}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Retry
                  </button>
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
                <div className="bg-red-600 text-white px-4 py-2 rounded font-bold">
                  Multiple Faces!
                </div>
              </div>
            )}

            {/* Critical Violation Alert */}
            {criticalWarning && (
              <div className="absolute top-2 left-2 right-2 z-20">
                <div className={`px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm ${
                  criticalWarning.severity === 'critical'
                    ? 'bg-red-600/90'
                    : 'bg-orange-600/90'
                }`}>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
                    <p className="text-white text-xs font-medium flex-1">
                      {criticalWarning.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute top-2 right-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  status.camera ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}
              />
            </div>
          </div>

          {/* Status Indicators */}
          <div className="space-y-3">
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                status.camera ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  status.camera ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Camera
              </span>
              {status.camera ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                status.modelsLoaded
                  ? status.faceDetected
                    ? 'bg-green-50'
                    : 'bg-yellow-50'
                  : 'bg-gray-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  status.modelsLoaded
                    ? status.faceDetected
                      ? 'text-green-700'
                      : 'text-yellow-700'
                    : 'text-gray-500'
                }`}
              >
                {status.modelsLoaded ? 'Face Detection' : 'Loading Models...'}
              </span>
              {status.modelsLoaded ? (
                status.faceDetected ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                )
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                status.tabActive ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  status.tabActive ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Tab Status
              </span>
              {status.tabActive ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                isDetecting
                  ? gazeStatus === 'looking-away'
                    ? 'bg-red-50'
                    : 'bg-green-50'
                  : 'bg-gray-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  isDetecting
                    ? gazeStatus === 'looking-away'
                      ? 'text-red-700'
                      : 'text-green-700'
                    : 'text-gray-500'
                }`}
              >
                {isDetecting ? 'Eye Gaze' : 'Gaze Detection'}
              </span>
              {isDetecting ? (
                gazeStatus === 'looking-away' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Microphone Status */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                micStatus.microphone && isRecording && micStreamHealthy
                  ? 'bg-green-50'
                  : 'bg-red-50'
              }`}
            >
              <span className={`text-sm font-medium ${
                micStatus.microphone && isRecording && micStreamHealthy ? 'text-green-700' : 'text-red-700'
              }`}>
                Microphone {micStreamHealthy ? '✓' : '⚠️'}
              </span>
              {micStatus.microphone && isRecording && micStreamHealthy ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <MicOff className="w-4 h-4 text-red-600" />
              )}
            </div>

            {/* Subtle Distance Indicator (during exam) */}
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
                {/* Subtle progress bar */}
                <div className="mt-1 relative h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      Math.abs(faceDistanceCm - optimalDistanceCm) > 15 ? 'bg-orange-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.max(10, Math.min(90, (faceDistanceCm / 100) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question Navigator */}
        <div className="p-6 flex-1 overflow-auto">
          <h4 className="font-semibold text-gray-900 mb-4">Question Navigator</h4>
          <div className="grid grid-cols-5 gap-2">
            {mockQuestions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestion(index)}
                className={`aspect-square rounded-lg border-2 font-semibold text-sm ${
                  currentQuestion === index
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : answers[index + 1] !== undefined
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
