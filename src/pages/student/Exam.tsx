import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useProctoring } from '../../hooks/useProctoring';
import { useEyeGazeDetection } from '../../hooks/useEyeGazeDetection';
import { useLivenessCheck } from '../../hooks/useLivenessCheck';
import { EyeGazeMonitor } from '../../components/EyeGazeMonitor';
import { LivenessCheckModal } from '../../components/LivenessCheckModal';
import { mockQuestions } from '../../data/mockData';
import {
  Clock, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, CameraOff, Video, Eye
} from 'lucide-react';

export const Exam = () => {
  const navigate = useNavigate();
  const { currentExam } = useApp();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [timeRemaining, setTimeRemaining] = useState(5400);
  const [showLivenessCheck, setShowLivenessCheck] = useState(true);
  const [examStarted, setExamStarted] = useState(false);

  const { status, videoRef: proctoringVideoRef, retryCamera } = useProctoring(examStarted);
  const {
    gazeData,
    isDetecting,
    modelsLoaded: gazeModelsLoaded,
    loading: gazeLoading,
    error: gazeError,
    suspiciousEvents,
    videoRef: gazeVideoRef,
    startDetection,
    stopDetection,
    clearEvents,
    violationScore,
    violationLevel,
    setSensitivity
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
    videoRef: livenessVideoRef
  } = useLivenessCheck();

  const combinedVideoRef = useRef<HTMLVideoElement | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('[Exam] ========== STATE UPDATE ==========');
    console.log('[Exam] currentExam:', currentExam);
    console.log('[Exam] showLivenessCheck:', showLivenessCheck);
    console.log('[Exam] examStarted:', examStarted);
    console.log('[Exam] liveness - isChecking:', isChecking, 'isPassed:', livenessPassed, 'isFailed:', livenessFailed);
    console.log('[Exam] Camera - status.camera:', status.camera, 'loading:', status.loading);
    console.log('[Exam] Gaze - modelsLoaded:', gazeModelsLoaded, 'isDetecting:', isDetecting, 'loading:', gazeLoading);
    console.log('[Exam] Gaze - gazeData:', gazeData);
    console.log('[Exam] ====================================');
  }, [currentExam, showLivenessCheck, isChecking, livenessPassed, livenessFailed, status.camera, gazeModelsLoaded, isDetecting, examStarted, gazeData, gazeLoading]);

  // Start eye gaze detection when models are loaded and camera is ready AND exam has started
  useEffect(() => {
    console.log('[Exam] Checking if should start gaze detection...');
    console.log('[Exam] Conditions:');
    console.log('  - examStarted:', examStarted);
    console.log('  - gazeModelsLoaded:', gazeModelsLoaded);
    console.log('  - status.camera:', status.camera);
    console.log('  - isDetecting:', isDetecting);
    
    if (examStarted && gazeModelsLoaded && status.camera && !isDetecting) {
      console.log('[Exam] ✅ All conditions met - Starting eye gaze detection...');
      startDetection();
    } else {
      console.log('[Exam] ⏸️ Not starting - conditions not met');
    }
  }, [examStarted, gazeModelsLoaded, status.camera, isDetecting, startDetection]);

  // Stop detection on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  // Combined video ref for both proctoring and eye gaze
  const setCombinedVideoRef = useCallback((element: HTMLVideoElement | null) => {
    console.log('[Exam] 📹 Video ref callback called with:', element);
    combinedVideoRef.current = element;
    proctoringVideoRef(element);
    gazeVideoRef(element);
    console.log('[Exam] ✅ Video ref passed to proctoring and gaze hooks');
  }, [proctoringVideoRef, gazeVideoRef]);

  // Separate ref just for liveness check modal
  const setLivenessVideoRef = useCallback((element: HTMLVideoElement | null) => {
    console.log('[Exam] Liveness video ref set:', element !== null);
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
    navigate('/results');
  }, [navigate]);

  const handleLivenessComplete = useCallback(() => {
    // Only allow exam start if liveness check passed
    if (livenessPassed) {
      console.log('[Exam] Liveness check passed, starting exam');
      setShowLivenessCheck(false);
      setExamStarted(true);
    } else {
      console.warn('[Exam] Attempted to start exam without passing liveness check');
    }
  }, [livenessPassed]);

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

  // Show "no exam" state if navigating directly to /exam
  if (!currentExam) {
    console.log('[Exam] No currentExam, showing navigation message');
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

  // Show liveness check modal before exam starts
  if (showLivenessCheck) {
    console.log('[Exam] Rendering LivenessCheckModal - isChecking:', isChecking, 'isPassed:', livenessPassed, 'isFailed:', livenessFailed);
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

            {gazeData?.isLookingAway && (
              <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center animate-pulse">
                <div className="bg-yellow-600 text-white px-4 py-2 rounded font-bold flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Looking Away!
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
                gazeModelsLoaded
                  ? isDetecting
                    ? 'bg-green-50'
                    : 'bg-blue-50'
                  : 'bg-gray-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  gazeModelsLoaded
                    ? isDetecting
                      ? 'text-green-700'
                      : 'text-blue-700'
                    : 'text-gray-500'
                }`}
              >
                {gazeModelsLoaded ? 'Eye Gaze Tracking' : 'Loading...'}
              </span>
              {gazeModelsLoaded ? (
                isDetecting ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Eye className="w-4 h-4 text-blue-600" />
                )
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Eye Gaze Monitor */}
        <EyeGazeMonitor
          gazeData={gazeData}
          isDetecting={isDetecting}
          modelsLoaded={gazeModelsLoaded}
          loading={gazeLoading}
          error={gazeError}
          suspiciousEvents={suspiciousEvents}
          onStartDetection={startDetection}
          onStopDetection={stopDetection}
          onClearEvents={clearEvents}
          violationScore={violationScore}
          violationLevel={violationLevel}
          setSensitivity={setSensitivity}
        />

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
