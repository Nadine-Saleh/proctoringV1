import { useState, useCallback, useRef, useEffect } from 'react';
import { Target, CheckCircle, ArrowRight } from 'lucide-react';

interface FaceLandmarker {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  };
}

interface CalibrationModalProps {
  isOpen: boolean;
  onComplete: (offsets: { x: number; y: number }) => void;
  onCancel: () => void;
  videoElement: HTMLVideoElement | null;
  faceLandmarker: FaceLandmarker;
}

interface CalibrationPoint {
  position: { x: number; y: number }; // screen percentage (0-1)
  label: string;
}

const CALIBRATION_POINTS: CalibrationPoint[] = [
  { position: { x: 0.5, y: 0.5 }, label: 'Look at the center dot' },
  { position: { x: 0.1, y: 0.1 }, label: 'Look at the top-left dot' },
  { position: { x: 0.9, y: 0.1 }, label: 'Look at the top-right dot' },
  { position: { x: 0.1, y: 0.9 }, label: 'Look at the bottom-left dot' },
  { position: { x: 0.9, y: 0.9 }, label: 'Look at the bottom-right dot' },
];

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onComplete,
  onCancel,
  videoElement,
  faceLandmarker
}) => {
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const gazeSamplesRef = useRef<{ x: number; y: number }[]>([]);
  const collectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentPoint = CALIBRATION_POINTS[currentPointIndex];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPointIndex(0);
      setIsCollecting(false);
      setIsComplete(false);
      setCountdown(3);
      gazeSamplesRef.current = [];
    }
  }, [isOpen]);

  // Countdown before starting
  useEffect(() => {
    if (isOpen && !isCollecting && !isComplete && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isCollecting) {
      startCollection();
    }
  }, [countdown, isCollecting, isComplete, isOpen, startCollection]);

  const startCollection = useCallback(() => {
    setIsCollecting(true);
    collectGazeSamples();
  }, [collectGazeSamples]);

  const collectGazeSamples = useCallback(() => {
    if (!videoElement || !faceLandmarker) {
      console.warn('[Calibration] Video or face landmarker not available');
      return;
    }

    const video = videoElement;
    const samples: { x: number; y: number }[] = [];
    const SAMPLE_DURATION = 500; // ms per sample
    const SAMPLE_INTERVAL = 100; // ms between samples
    let elapsed = 0;

    const collectSample = () => {
      if (elapsed >= SAMPLE_DURATION || !isCollecting) {
        // Move to next point or complete
        const avgX = samples.length > 0
          ? samples.reduce((sum, s) => sum + s.x, 0) / samples.length
          : 0.5;
        const avgY = samples.length > 0
          ? samples.reduce((sum, s) => sum + s.y, 0) / samples.length
          : 0.5;

        gazeSamplesRef.current.push({ x: avgX, y: avgY });

        if (currentPointIndex < CALIBRATION_POINTS.length - 1) {
          setCurrentPointIndex(prev => prev + 1);
          setCountdown(2);
          setIsCollecting(false);
        } else {
          // Calibration complete
          finishCalibration();
        }
        return;
      }

      try {
        const result = faceLandmarker.detectForVideo(video, performance.now());

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];

          // Get eye landmarks (indices 468-473 for left eye, 474-479 for right eye)
          const leftEyeCenter = landmarks[468];
          const rightEyeCenter = landmarks[474];

          if (leftEyeCenter && rightEyeCenter) {
            const avgEyeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
            const avgEyeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

            // MediaPipe returns coordinates in normalized space (0-1)
            // Mirror x-axis due to selfie mode
            samples.push({
              x: 1 - avgEyeX,
              y: avgEyeY
            });
          }
        }
      } catch (error) {
        console.warn('[Calibration] Error collecting sample:', error);
      }

      elapsed += SAMPLE_INTERVAL;
      collectionTimeoutRef.current = setTimeout(collectSample, SAMPLE_INTERVAL);
    };

    // Start collecting after countdown for this point
    if (countdown <= 0) {
      collectionTimeoutRef.current = setTimeout(collectSample, SAMPLE_INTERVAL);
    }
  }, [videoElement, faceLandmarker, currentPointIndex, isCollecting, countdown, finishCalibration]);

  const finishCalibration = useCallback(() => {
    if (collectionTimeoutRef.current) {
      clearTimeout(collectionTimeoutRef.current);
    }

    setIsCollecting(false);
    setIsComplete(true);

    // Calculate calibration offsets
    // Compare expected positions vs actual gaze positions
    const expectedPositions = CALIBRATION_POINTS.map(p => p.position);
    const actualPositions = gazeSamplesRef.current;

    if (actualPositions.length === expectedPositions.length) {
      let totalOffsetX = 0;
      let totalOffsetY = 0;

      for (let i = 0; i < expectedPositions.length; i++) {
        totalOffsetX += actualPositions[i].x - expectedPositions[i].x;
        totalOffsetY += actualPositions[i].y - expectedPositions[i].y;
      }

      const avgOffsetX = totalOffsetX / expectedPositions.length;
      const avgOffsetY = totalOffsetY / expectedPositions.length;

      console.log('[Calibration] Calculated offsets:', { x: avgOffsetX, y: avgOffsetY });
      onComplete({ x: avgOffsetX, y: avgOffsetY });
    } else {
      console.warn('[Calibration] Incomplete calibration data, using zero offsets');
      onComplete({ x: 0, y: 0 });
    }
  }, [onComplete]);

  const handleCancel = useCallback(() => {
    if (collectionTimeoutRef.current) {
      clearTimeout(collectionTimeoutRef.current);
    }
    onCancel();
  }, [onCancel]);

  if (!isOpen) return null;

  // Show completion state
  if (isComplete) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card max-w-md p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-success-50 ring-1 ring-success-200 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-success-600" />
            </div>
            <h2 className="text-xl font-semibold text-ink-900 tracking-tight2 mb-2">
              Calibration complete
            </h2>
            <p className="text-sm text-ink-600 mb-6">
              Gaze tracking has been calibrated for your setup.
            </p>
            <button onClick={handleCancel} className="btn btn-md btn-primary w-full">
              Continue to exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-md">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-ink-900 tracking-tight2 mb-1">
            Gaze calibration
          </h2>
          <p className="text-sm text-ink-600">
            Follow the dots with your eyes to calibrate tracking.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
              Progress
            </span>
            <span className="text-xs font-mono tabular-nums text-ink-700">
              {currentPointIndex + 1} / {CALIBRATION_POINTS.length}
            </span>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-500"
              style={{
                width: `${((currentPointIndex + 1) / CALIBRATION_POINTS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Current instruction */}
        <div className="text-center mb-6 p-5 bg-brand-50 border border-brand-100 rounded-xl">
          <p className="text-base font-semibold text-brand-800 tracking-tight2">
            {currentPoint.label}
          </p>
          {countdown > 0 && !isCollecting && (
            <p className="text-4xl font-semibold text-brand-700 mt-2 tabular-nums tracking-tight2 animate-scale-in">
              {countdown}
            </p>
          )}
          {isCollecting && (
            <p className="text-xs text-brand-700 mt-2 uppercase font-semibold tracking-wider animate-pulse-soft">
              Collecting gaze data…
            </p>
          )}
        </div>

        {/* Navigation hint */}
        {currentPointIndex > 0 &&
          currentPointIndex < CALIBRATION_POINTS.length - 1 &&
          !isCollecting &&
          countdown > 0 && (
            <div className="flex items-center justify-center text-ink-500 text-xs mb-4">
              <ArrowRight className="w-3.5 h-3.5 mr-2" />
              Get ready for the next position
            </div>
          )}

        {/* Cancel button */}
        <button onClick={handleCancel} className="btn btn-md btn-secondary w-full">
          Skip calibration
        </button>
      </div>

      {/* Calibration dots overlay */}
      {isCollecting && (
        <div className="absolute inset-0 pointer-events-none">
          {CALIBRATION_POINTS.map(
            (point, index) =>
              index === currentPointIndex && (
                <div
                  key={index}
                  className="absolute w-9 h-9 rounded-full bg-brand-700 border-4 border-white shadow-lg animate-pulse-ring"
                  style={{
                    left: `${point.position.x * 100}%`,
                    top: `${point.position.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )
          )}
        </div>
      )}
    </div>
  );
};
