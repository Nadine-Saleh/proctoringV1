import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProctoring } from './useProctoring';
import { useGazeTracking } from './useGazeTracking';
import { useLivenessCheck } from './useLivenessCheck';
import { useExamSession } from './useExamSession';
import { useExamAnswers } from './useExamAnswers';
import { useViolationTracker } from './useViolationTracker';
import { useTabFocusTracker } from './useTabFocusTracker';
import { usePoseDetection } from './usePoseDetection';
import { EvidenceSnippetService } from '../services/EvidenceSnippetService';
import {
  IdentityVerificationService,
  type StartSessionResponse,
  type JoinExamResponse,
} from '../services/IdentityVerificationService';
import { DistanceCalibrationService } from '../services/DistanceCalibrationService';
import { ExamSessionService } from '../services/examSessionService';
import { CheatingScoreTracker } from '../services/CheatingScoreService';
import type { ProctoringPolicy } from '../types/examSession';
import type { ExamQuestion, SessionCalibration, WarningBannerState } from '../types/exam';

const DEFAULT_POLICY: ProctoringPolicy = {
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

const CLOSED_SESSION_STATUSES = new Set(['submitted', 'auto_submitted', 'terminated']);

const STEP_STORAGE_PREFIX = 'proctoring_steps_';
const STEP_STORAGE_EXAM_KEY = 'current_exam_id';
type StepName = 'distance' | 'liveness';
type StepsRecord = Partial<Record<StepName, boolean>>;

const readStoredSteps = (examId: string): StepsRecord => {
  try {
    const stored = localStorage.getItem(`${STEP_STORAGE_PREFIX}${examId}`);
    return stored ? (JSON.parse(stored) as StepsRecord) : {};
  } catch {
    return {};
  }
};

const writeStoredStep = (examId: string, step: StepName) => {
  try {
    const key = `${STEP_STORAGE_PREFIX}${examId}`;
    const steps = readStoredSteps(examId);
    steps[step] = true;
    localStorage.setItem(key, JSON.stringify(steps));
    localStorage.setItem(STEP_STORAGE_EXAM_KEY, examId);
  } catch (e) {
    console.warn('[Exam] Failed to save step:', step, e);
  }
};

const clearStoredSteps = (examId: string) => {
  try {
    localStorage.removeItem(`${STEP_STORAGE_PREFIX}${examId}`);
    const stored = localStorage.getItem(STEP_STORAGE_EXAM_KEY);
    if (stored === examId) localStorage.removeItem(STEP_STORAGE_EXAM_KEY);
  } catch (e) {
    console.warn('[Exam] Failed to clear storage:', e);
  }
};

const PER_EVENT_BANNER_TTL_MS = 4000;
const DISTANCE_RANGE_MIN_CM = 30;
const DISTANCE_RANGE_SPAN_CM = 70;
const SEVERITY_SNAPSHOT_THRESHOLD = 15;
const SEVERITY_BANNER_THRESHOLD = 10;
const SEVERITY_CRITICAL_THRESHOLD = 20;

export const useExamFlow = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const locationState = location.state as
    | { sessionData?: StartSessionResponse; joinData?: JoinExamResponse }
    | null;
  const { currentExam, user } = useApp();

  const currentExamId = currentExam?.id ? String(currentExam.id) : undefined;
  const currentExamDuration = currentExam?.duration ?? 90;
  const currentPolicy: ProctoringPolicy =
    (locationState?.joinData?.exam?.proctoring_policy as ProctoringPolicy | undefined) ??
    (currentExam?.proctoring_policy as ProctoringPolicy | undefined) ??
    DEFAULT_POLICY;

  const [questions, setQuestions] = useState<ExamQuestion[]>(
    () => (locationState?.sessionData?.questions as ExamQuestion[]) ?? []
  );

  const scoreTracker = useMemo(() => new CheatingScoreTracker(currentPolicy), [currentPolicy]);

  const {
    session,
    isLoading: sessionLoading,
    error: sessionError,
    submitExam,
    timeElapsed,
    startTimer,
    loadSession,
  } = useExamSession();

  // The US2 join → verify → begin flow only sets `sessionId` + `lifecycleStatus`,
  // never `session`. Without this hydration, handleFinalSubmit's `if (!session)`
  // guard short-circuits and the submission never persists.
  useEffect(() => {
    if (sessionId && !session) {
      loadSession(sessionId);
    }
  }, [sessionId, session, loadSession]);

  const totalQuestions = questions.length;
  const {
    answers,
    answeredCount,
    setCurrentQuestion: trackCurrentQuestion,
    selectAnswer,
    getSubmittedAnswers,
    syncToServer,
  } = useExamAnswers(totalQuestions);

  const {
    violations: trackedViolations,
    violationCount,
    recordViolation,
    syncViolations,
    liveScore,
    warningThresholdCrossed,
    criticalThresholdCrossed,
  } = useViolationTracker(session?.id ?? sessionId, currentExamId, user?.id, scoreTracker);

  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(currentExamDuration * 60);
  const [showLivenessCheck, setShowLivenessCheck] = useState(false);
  const [showDistanceSetup, setShowDistanceSetup] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<'center' | 'looking-away'>('center');
  const [warningBanner, setWarningBanner] = useState<WarningBannerState | null>(null);
  const [sessionCalibration, setSessionCalibration] = useState<SessionCalibration | null>(null);
  const [combinedVideoElement, setCombinedVideoElement] = useState<HTMLVideoElement | null>(null);

  const {
    status,
    videoRef: proctoringVideoRef,
    retryCamera,
    setCanonicalViolationCallback,
    captureViolationSnapshot,
  } = useProctoring(
    examStarted,
    sessionCalibration?.optimal_distance_cm,
    sessionCalibration?.distance_tolerance_cm,
  );

  const {
    isRunning: gazeRunning,
    modelsLoaded: gazeModelsLoaded,
    currentSample: gazeSample,
    currentZone: gazeZone,
    start: startGazeTracking,
    videoRef: gazeVideoRef,
  } = useGazeTracking({
    sensitivity: 'medium',
    enableCalibration: false,
    enableWarnings: true,
    proctoringPolicy: currentPolicy,
    onCanonicalViolation: (v) => {
      if (!(session?.id ?? sessionId) || !examStarted) return;
      const persistedType = v.type === 'gaze_peripheral' ? 'gaze_looking_away' : 'gaze_prolonged_away';
      recordViolation({
        violation_type: persistedType,
        severity: v.severity,
        occurred_at: v.client_captured_at,
        duration_ms: v.duration_ms,
        description: v.description,
        metadata: { ...v.metadata, emitted_type: v.type } as Record<string, unknown>,
        client_event_id: '',
        type: persistedType,
        client_captured_at: v.client_captured_at,
      });
    },
  });

  const liveness = useLivenessCheck();
  const combinedVideoRef = useRef<HTMLVideoElement | null>(null);

  const {
    isModelLoaded: poseModelLoaded,
    isDetecting: poseDetecting,
    frameStatus: poseFrameStatus,
    statusMessage: poseStatusMessage,
    startDetection: startPoseDetection,
    stopDetection: stopPoseDetection,
    loadingProgress: poseLoadingProgress,
  } = usePoseDetection();

  const gazeDistanceCm = gazeSample
    ? Math.round(DISTANCE_RANGE_MIN_CM + (1 - gazeSample.faceDistance) * DISTANCE_RANGE_SPAN_CM)
    : null;
  const faceDistanceCm = examStarted ? gazeDistanceCm : liveness.faceDistanceCm;

  useTabFocusTracker({
    enabled: examStarted,
    onViolation: (v) => {
      if (!(session?.id ?? sessionId)) return;
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

  useEffect(() => {
    const sid = session?.id ?? sessionId;
    if (!examStarted || !sid) return;

    setCanonicalViolationCallback(async (v) => {
      let evidenceImage: string | null = null;
      let evidence: { captured: boolean; bucket_path: string; content_type: string; byte_length: number } | null = null;

      if (v.severity >= SEVERITY_SNAPSHOT_THRESHOLD) {
        evidenceImage = await captureViolationSnapshot();
        
        // If snapshot captured and policy allows, upload to storage
        if (evidenceImage && currentPolicy.visual_evidence_allowed) {
          try {
            const uploaded = await EvidenceSnippetService.upload({
              sessionId: sid,
              data: evidenceImage,
            });
            evidence = {
              captured: true,
              bucket_path: uploaded.bucket_path,
              content_type: uploaded.content_type,
              byte_length: uploaded.byte_length,
            };
          } catch (err) {
            console.error('[useExamFlow] Failed to upload evidence:', err);
          }
        }
      }

      recordViolation({
        violation_type: v.type,
        severity: v.severity,
        occurred_at: v.client_captured_at,
        description: v.description,
        evidence_image: evidenceImage,
        evidence,
        metadata: v.metadata ?? {},
        client_event_id: '',
        type: v.type,
        client_captured_at: v.client_captured_at,
      });
    });
  }, [examStarted, session?.id, sessionId, setCanonicalViolationCallback, captureViolationSnapshot, recordViolation, currentPolicy.visual_evidence_allowed]);

  useEffect(() => {
    if (examStarted && gazeModelsLoaded && status.camera && !gazeRunning) {
      startGazeTracking();
    }
  }, [examStarted, gazeModelsLoaded, status.camera, gazeRunning, startGazeTracking]);

  useEffect(() => {
    if (
      examStarted &&
      poseModelLoaded &&
      status.camera &&
      !poseDetecting &&
      combinedVideoElement
    ) {
      startPoseDetection(combinedVideoElement);
    }
  }, [examStarted, poseModelLoaded, status.camera, poseDetecting, combinedVideoElement, startPoseDetection]);

  useEffect(() => () => stopPoseDetection(), [stopPoseDetection]);

  useEffect(() => {
    setGazeStatus(gazeZone === 'on_screen' ? 'center' : 'looking-away');
  }, [gazeZone]);

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

  useEffect(() => {
    if (!examStarted || violationCount === 0) return;
    const latest = trackedViolations[trackedViolations.length - 1];
    if (!latest) return;
    const sev = typeof latest.severity === 'number' ? latest.severity : 0;
    if (sev < SEVERITY_BANNER_THRESHOLD) return;

    const message = latest.description || 'Proctoring violation detected.';
    setWarningBanner((prev) =>
      prev?.level === 'critical' ? prev : { message, level: sev >= SEVERITY_CRITICAL_THRESHOLD ? 'critical' : 'warning' }
    );

    const timer = setTimeout(() => {
      setWarningBanner((prev) => (!prev || prev.message === message ? null : prev));
    }, PER_EVENT_BANNER_TTL_MS);
    return () => clearTimeout(timer);
  }, [violationCount, trackedViolations, examStarted]);

  const setCombinedVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      combinedVideoRef.current = element;
      setCombinedVideoElement(element);
      proctoringVideoRef(element);
      gazeVideoRef(element);
    },
    [proctoringVideoRef, gazeVideoRef],
  );

  useEffect(() => {
    if (!examStarted) return;
    const duration = currentExamDuration * 60;
    setTimeRemaining(Math.max(0, duration - timeElapsed));
  }, [timeElapsed, examStarted, currentExamDuration]);

  useEffect(() => {
    const q = questions[currentQuestion];
    if (q) trackCurrentQuestion(q.id);
  }, [currentQuestion, questions, trackCurrentQuestion]);

  useEffect(() => {
    if (session?.id && answeredCount > 0) syncToServer(session.id);
  }, [answeredCount, session?.id, syncToServer]);

  useEffect(() => {
    const sid = session?.id ?? sessionId;
    if (!examStarted || !sid || questions.length > 0) return;
    IdentityVerificationService.startSession(sid, DistanceCalibrationService.asSkipped()).then((result) => {
      if (!result.success || !result.data?.questions?.length) return;
      setQuestions(result.data.questions as ExamQuestion[]);
      if (!sessionCalibration && result.data.session) {
        const cal = result.data.session;
        setSessionCalibration({
          optimal_distance_cm: cal.optimal_distance_cm,
          distance_tolerance_cm: cal.distance_tolerance_cm,
          calibration_skipped: cal.calibration_skipped,
        });
      }
    });
  }, [examStarted, session?.id, sessionId, questions.length, sessionCalibration]);

  useEffect(() => {
    if (!currentExam && !sessionLoading) navigate('/');
  }, [currentExam, sessionLoading, navigate]);

  // Block direct entry into a session that has already been closed.
  // Without this, a stale URL/back-button could re-render the exam UI for a
  // submitted session — the student must not be able to answer or re-submit.
  useEffect(() => {
    const sid = sessionId;
    if (!sid) return;
    let cancelled = false;
    ExamSessionService.getById(sid).then((result) => {
      if (cancelled || !result.success || !result.session) return;
      if (CLOSED_SESSION_STATUSES.has(result.session.status)) {
        navigate(`/exam/${sid}/results`, { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const handleSelectAnswer = useCallback(
    (questionId: string, answerIndex: number) => selectAnswer(questionId, answerIndex),
    [selectAnswer],
  );

  const handleSubmit = useCallback(() => setShowSubmissionModal(true), []);
  const handleCancelSubmit = useCallback(() => setShowSubmissionModal(false), []);

  const handleFinalSubmit = useCallback(async () => {
    // Use whichever sessionId is available — `session` is only populated in the
    // legacy startSession flow; the US2 flow only has the URL param.
    const targetSessionId = session?.id ?? sessionId;
    if (!targetSessionId) {
      setSubmissionError('Could not identify exam session.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    // Keep modal open during submit so its spinner stays visible.

    // Hard safety timeout — if any await hangs indefinitely, surface an error
    // and let the user retry instead of leaving the button locked forever.
    const watchdog = setTimeout(() => {
      console.error('[handleFinalSubmit] Watchdog: submission still pending after 45s');
      setSubmissionError('Submission is taking too long. Please check your connection and try again.');
      setIsSubmitting(false);
      setShowSubmissionModal(false);
    }, 45_000);

    try {
      console.log('[handleFinalSubmit] step 1/4: syncViolations');
      await syncViolations();
      console.log('[handleFinalSubmit] step 2/4: syncToServer');
      await syncToServer(targetSessionId);
      console.log('[handleFinalSubmit] step 3/4: getSubmittedAnswers');
      const submittedAnswers = getSubmittedAnswers();
      console.log('[handleFinalSubmit] step 4/4: submitExam', { targetSessionId, count: submittedAnswers.length });
      const result = await submitExam(submittedAnswers, timeElapsed, {
        sessionId: targetSessionId,
        examId: currentExamId,
      });
      console.log('[handleFinalSubmit] submitExam returned', result);

      clearTimeout(watchdog);

      if (result.success) {
        if (currentExamId) clearStoredSteps(currentExamId);
        setShowSubmissionModal(false);
        setIsSubmitting(false);
        navigate(`/exam/${targetSessionId}/results`, {
          replace: true,
          state: { submissionResult: result },
        });
      } else {
        setSubmissionError(result.error ?? 'Submission failed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[handleFinalSubmit] threw', err);
      setSubmissionError(err instanceof Error ? err.message : 'Unknown error');
      setIsSubmitting(false);
    }
  }, [session, sessionId, currentExamId, syncViolations, syncToServer, getSubmittedAnswers, submitExam, timeElapsed, navigate]);

  const handleSetOptimalDistance = useCallback(
    async (distance: number) => {
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
      if (currentExamId) writeStoredStep(currentExamId, 'distance');
      setShowDistanceSetup(false);
      setShowLivenessCheck(true);
    },
    [sessionId, currentExamId],
  );

  const handleLivenessComplete = useCallback(async () => {
    if (liveness.isPassed) {
      if (currentExamId) writeStoredStep(currentExamId, 'liveness');
      setShowLivenessCheck(false);
      setExamStarted(true);
      startTimer();
    }
  }, [liveness.isPassed, currentExamId, startTimer]);

  const stepsRestoredRef = useRef(false);
  useEffect(() => {
    if (!currentExamId || stepsRestoredRef.current) return;
    stepsRestoredRef.current = true;

    const storedExamId = localStorage.getItem(STEP_STORAGE_EXAM_KEY);
    if (storedExamId && storedExamId !== currentExamId) {
      clearStoredSteps(storedExamId);
      return;
    }

    const steps = readStoredSteps(currentExamId);
    if (steps.liveness) {
      setShowDistanceSetup(false);
      setShowLivenessCheck(false);
      setExamStarted(true);
      startTimer();
    } else if (steps.distance) {
      setShowDistanceSetup(false);
      setShowLivenessCheck(true);
    }
  }, [currentExamId, startTimer]);

  const handleLivenessRetry = useCallback(() => {
    liveness.resetCheck();
    setTimeout(() => liveness.startCheck(), 500);
  }, [liveness]);

  const goToPreviousQuestion = useCallback(
    () => setCurrentQuestion((i) => Math.max(0, i - 1)),
    [],
  );
  const goToNextQuestion = useCallback(
    () => setCurrentQuestion((i) => Math.min(questions.length - 1, i + 1)),
    [questions.length],
  );

  return {
    navigate,
    currentExam,
    sessionLoading,
    sessionError,

    questions,
    currentQuestion,
    setCurrentQuestion,
    goToPreviousQuestion,
    goToNextQuestion,

    answers,
    answeredCount,
    handleSelectAnswer,

    timeRemaining,
    timeElapsed,

    examStarted,
    showDistanceSetup,
    showLivenessCheck,
    handleSetOptimalDistance,
    handleLivenessComplete,
    handleLivenessRetry,
    liveness,
    setLivenessVideoRef: liveness.videoRef,

    status,
    setCombinedVideoRef,
    combinedVideoElement,
    retryCamera,

    gazeRunning,
    gazeStatus,

    poseDetecting,
    poseModelLoaded,
    poseFrameStatus,
    poseStatusMessage,
    poseLoadingProgress,

    faceDistanceCm,
    sessionCalibration,
    session,

    liveScore,
    warningThresholdCrossed,
    criticalThresholdCrossed,
    warningBanner,
    setWarningBanner,

    showSubmissionModal,
    isSubmitting,
    submissionError,
    setSubmissionError,
    handleSubmit,
    handleCancelSubmit,
    handleFinalSubmit,
  };
};
