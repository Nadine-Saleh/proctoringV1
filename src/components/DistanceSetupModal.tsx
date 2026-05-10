import { ArrowLeftRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionResult {
  detection?: {
    box?: DetectionBox;
  };
}

interface DistanceSetupModalProps {
  onComplete: (optimalDistance: number) => void;
}

export const DistanceSetupModal = ({ onComplete }: DistanceSetupModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const stableDistanceRef = useRef<number | null>(null);

  const log = (msg: string) => console.log('[DistanceSetup]', msg);

  // Estimate face distance from detection box
  const estimateFaceDistance = useCallback((detection: DetectionResult): number => {
    if (!detection || !detection.detection || !detection.detection.box) return 50;
    
    const box = detection.detection.box;
    const boxSize = Math.max(box.width || 0, box.height || 0);
    const normalizedSize = boxSize / 640;
    const estimatedCm = normalizedSize > 0.05 ? Math.round(15 / normalizedSize) : 80;
    
    return Math.max(20, Math.min(100, estimatedCm));
  }, []);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        log('Loading models...');
        const MODEL_URL = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        log('✓ Models loaded');
      } catch (err) {
        const error = err as Error;
        log('✗ Model loading error: ' + error.message);
        setCameraError('Failed to load face detection models');
      }
    };
    loadModels();
  }, []);

  // Setup camera
  useEffect(() => {
    let isMounted = true;

    const setupCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Browser does not support camera access');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });

        streamRef.current = stream;

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          log('✓ Camera ready');
        }
      } catch (err) {
        const error = err as Error;
        console.error('[DistanceSetup] Camera error:', error);
        if (isMounted) {
          setCameraError(error.message || 'Failed to access camera');
        }
      }
    };

    if (modelsLoaded) {
      setupCamera();
    }

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (detectionRef.current) {
        clearTimeout(detectionRef.current);
      }
    };
  }, [modelsLoaded]);

  // Start distance detection
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !modelsLoaded) return;

    const element = videoRef.current;
    let isRunning = true;

    const detectDistance = async () => {
      if (!isRunning || !videoRef.current) return;

      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) return;

        const detections = await faceapi.detectAllFaces(
          element,
          new faceapi.TinyFaceDetectorOptions()
        );

        if (detections.length === 1 && isRunning) {
          const distance = estimateFaceDistance({ detection: detections[0] });
          setCurrentDistance(distance);
          log(`📏 Distance: ${distance}cm`);

          // Check if distance is stable (within 5cm range for 2 seconds)
          if (stableDistanceRef.current !== null && 
              Math.abs(distance - stableDistanceRef.current) <= 5) {
            const newCount = stableCount + 1;
            setStableCount(newCount);
          } else {
            stableDistanceRef.current = distance;
            setStableCount(0);
          }
        } else if (detections.length === 0 && isRunning) {
          setStableCount(0);
          stableDistanceRef.current = null;
        }
      } catch (_err) {
        // Silent fail
      }

      if (isRunning) {
        detectionRef.current = setTimeout(detectDistance, 200);
      }
    };

    detectDistance();

    return () => {
      isRunning = false;
      if (detectionRef.current) {
        clearTimeout(detectionRef.current);
      }
    };
  }, [cameraReady, modelsLoaded, estimateFaceDistance, stableCount]);

  const handleSetDistance = () => {
    if (currentDistance && stableCount >= 5) {
      log(`✓ Setting optimal distance: ${currentDistance}cm`);
      onComplete(currentDistance);
    }
  };

  const isDistanceGood = currentDistance !== null && currentDistance >= 30 && currentDistance <= 70;
  const isTooClose = currentDistance !== null && currentDistance < 30;
  const isTooFar = currentDistance !== null && currentDistance > 70;

  const stable = stableCount >= 10;

  return (
    <div className="modal-backdrop">
      <div className="modal-card max-w-md">
        {/* Header */}
        <div className="bg-brand-gradient px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                Step 1 of 3
              </div>
              <h2 className="text-lg font-semibold text-white tracking-tight2">
                Camera Distance Setup
              </h2>
            </div>
          </div>
          <p className="text-brand-100 mt-2.5 text-sm leading-relaxed">
            Position yourself at a comfortable distance for accurate face tracking.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video */}
          <div className="relative aspect-video bg-ink-950 rounded-xl overflow-hidden mb-5 ring-1 ring-ink-900/60">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="relative w-12 h-12 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-brand-300 animate-spin" />
                  </div>
                  <p className="text-xs font-medium tracking-wide uppercase text-white/80">
                    Setting up camera
                  </p>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-danger-900/85 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <AlertTriangle className="w-9 h-9 text-danger-300 mx-auto mb-2" />
                  <p className="text-sm">{cameraError}</p>
                </div>
              </div>
            )}

            {cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`relative w-40 h-48 rounded-2xl ring-2 ring-dashed transition-colors duration-300 ${
                    isDistanceGood ? 'ring-success-400/80' : 'ring-white/40'
                  }`}
                >
                  {/* corner accents */}
                  <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white/80 rounded-tl-md" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white/80 rounded-tr-md" />
                  <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white/80 rounded-bl-md" />
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white/80 rounded-br-md" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/70 text-xs font-medium">Position face</span>
                  </div>
                </div>
              </div>
            )}

            {cameraReady && (
              <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse-soft" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/90">
                  Live
                </span>
              </div>
            )}
          </div>

          {/* Distance Display */}
          {currentDistance ? (
            <div className="panel p-4 mb-5">
              <div className="flex items-baseline justify-center gap-1 mb-3">
                <span className="text-3xl font-semibold text-ink-900 tabular-nums tracking-tight2">
                  {currentDistance}
                </span>
                <span className="text-sm text-ink-500 font-medium">cm</span>
              </div>

              {/* Distance bar */}
              <div className="relative h-2 bg-ink-100 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute top-0 h-full bg-success-200/70"
                  style={{ left: '12.5%', width: '50%' }}
                />
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm transition-all duration-200 ${
                    isDistanceGood
                      ? 'bg-success-500'
                      : isTooClose
                      ? 'bg-warning-500'
                      : 'bg-warning-500'
                  }`}
                  style={{ left: `${Math.max(0, Math.min(100, (currentDistance / 100) * 100))}%` }}
                />
              </div>

              <div className="flex justify-between text-2xs text-ink-400 mt-2 tabular-nums">
                <span>20cm</span>
                <span className="text-success-700 font-medium">Optimal 30–70cm</span>
                <span>100cm</span>
              </div>

              {/* Feedback */}
              <div className="mt-3 pt-3 border-t border-ink-100">
                {isDistanceGood ? (
                  <div className="flex items-center gap-2 text-success-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {stable ? 'Distance stable — ready to continue' : 'Hold still while we lock in…'}
                    </span>
                  </div>
                ) : isTooClose ? (
                  <div className="flex items-center gap-2 text-warning-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Too close — move back slightly</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-warning-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Too far — move closer</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 mb-5 rounded-xl bg-brand-50/60 border border-brand-100 text-center">
              <p className="text-sm text-brand-800 font-medium">
                {cameraReady
                  ? 'Position your face inside the frame to begin measurement…'
                  : 'Initializing camera…'}
              </p>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleSetDistance}
            disabled={!isDistanceGood || stableCount < 5}
            className="btn btn-lg btn-primary w-full"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Continue to verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
