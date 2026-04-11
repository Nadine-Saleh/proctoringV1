import { ArrowLeftRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

interface DistanceSetupModalProps {
  onComplete: (optimalDistance: number) => void;
}

export const DistanceSetupModal = ({ onComplete }: DistanceSetupModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<any>(null);
  
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const stableDistanceRef = useRef<number | null>(null);

  const log = (msg: string) => console.log('[DistanceSetup]', msg);

  // Estimate face distance from detection box
  const estimateFaceDistance = useCallback((detection: any): number => {
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
      } catch (err: any) {
        log('✗ Model loading error: ' + err.message);
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
      } catch (err: any) {
        console.error('[DistanceSetup] Camera error:', err);
        if (isMounted) {
          setCameraError(err.message || 'Failed to access camera');
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
      } catch (err) {
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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <ArrowLeftRight className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Distance Setup</h2>
          </div>
          <p className="text-indigo-100 mt-1 text-sm">
            Position yourself at a comfortable distance from the camera
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Setting up camera...</p>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <p className="text-sm">{cameraError}</p>
                </div>
              </div>
            )}

            {/* Face guide overlay */}
            {cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-48 border-2 border-white/40 rounded-lg">
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/60 text-xs">Position face here</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Distance Display */}
          {currentDistance ? (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-center mb-3">
                <span className="text-3xl font-bold text-gray-900">~{currentDistance} cm</span>
              </div>

              {/* Distance bar */}
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full rounded-full transition-all duration-200 ${
                    isDistanceGood ? 'bg-green-500' : isTooClose ? 'bg-yellow-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.max(10, Math.min(90, (currentDistance / 100) * 100))}%` }}
                />
                {/* Optimal zone (30-70cm) */}
                <div className="absolute top-0 h-full bg-green-200/50" style={{ left: '30%', width: '40%' }} />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>20cm</span>
                <span className="text-green-600 font-medium">Optimal: 30-70cm</span>
                <span>100cm</span>
              </div>

              {/* Feedback */}
              {isDistanceGood && (
                <div className="mt-3 flex items-center justify-center space-x-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {stableCount >= 10 ? '✓ Distance stable! Click to continue.' : 'Good distance! Hold still...'}
                  </span>
                </div>
              )}
              {isTooClose && (
                <div className="mt-3 flex items-center justify-center space-x-2 text-yellow-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Too close! Move back slightly.</span>
                </div>
              )}
              {isTooFar && (
                <div className="mt-3 flex items-center justify-center space-x-2 text-orange-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Too far! Move closer.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-sm text-blue-700">
                {cameraReady ? 'Position your face in the frame to detect distance...' : 'Loading...'}
              </p>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleSetDistance}
            disabled={!isDistanceGood || stableCount < 5}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Continue to Verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
