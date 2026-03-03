import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceDetectionService, FaceDetectionConfig } from '../services/FaceDetectionService';
import { 
  LivenessDetectionModule, 
  LivenessConfig, 
  LivenessEvent, 
  LivenessStep 
} from '../services/LivenessDetectionModule';

interface UseFaceDetectionProps {
  faceDetectionConfig?: FaceDetectionConfig;
  livenessConfig?: LivenessConfig;
  onLivenessEvent?: (event: LivenessEvent, data?: any) => void;
  onDetection?: (faces: any[]) => void;
}

interface UseFaceDetectionResult {
  faceDetectionService: FaceDetectionService | null;
  livenessModule: LivenessDetectionModule | null;
  isModelsLoaded: boolean;
  isCameraActive: boolean;
  currentStep: LivenessStep | null;
  currentStepIndex: number;
  totalSteps: number;
  stepProgress: number;
  detectedFaces: any[];
  ageGender: { age: number; gender: string; probability: number } | null;
  errorMessage: string | null;
  startDetection: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => Promise<void>;
  stopDetection: () => void;
  retryLiveness: () => void;
  loadModels: () => Promise<void>;
}

export const useFaceDetection = (props: UseFaceDetectionProps = {}): UseFaceDetectionResult => {
  const { 
    faceDetectionConfig, 
    livenessConfig, 
    onLivenessEvent, 
    onDetection 
  } = props;

  const [isModelsLoaded, setIsModelsLoaded] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<LivenessStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [detectedFaces, setDetectedFaces] = useState<any[]>([]);
  const [ageGender, setAgeGender] = useState<{ age: number; gender: string; probability: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const faceDetectionServiceRef = useRef<FaceDetectionService | null>(null);
  const livenessModuleRef = useRef<LivenessDetectionModule | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize services
  useEffect(() => {
    faceDetectionServiceRef.current = new FaceDetectionService(faceDetectionConfig);
    livenessModuleRef.current = new LivenessDetectionModule(livenessConfig);

    // Setup event listeners for liveness module
    if (livenessModuleRef.current) {
      const stepStartedHandler = (event: LivenessEvent, data: any) => {
        setCurrentStep(data.step);
        setCurrentStepIndex(data.index);
        setTotalSteps(data.total);
        onLivenessEvent?.(event, data);
      };

      const stepPassedHandler = (event: LivenessEvent, data: any) => {
        setCurrentStepIndex(data.index);
        onLivenessEvent?.(event, data);
      };

      const progressUpdatedHandler = (event: LivenessEvent, data: any) => {
        setStepProgress(data.progress);
        onLivenessEvent?.(event, data);
      };

      const timeoutOccurredHandler = (event: LivenessEvent, data: any) => {
        setErrorMessage(`Timeout: ${data.step?.name || 'Step'} not completed in time`);
        onLivenessEvent?.(event, data);
      };

      const verificationCompleteHandler = (event: LivenessEvent, data: any) => {
        setCurrentStepIndex(data.totalSteps); // Set to total to trigger completion
        setStepProgress(1);
        onLivenessEvent?.(event, data);
      };

      livenessModuleRef.current.on(LivenessEvent.STEP_STARTED, stepStartedHandler);
      livenessModuleRef.current.on(LivenessEvent.STEP_PASSED, stepPassedHandler);
      livenessModuleRef.current.on(LivenessEvent.PROGRESS_UPDATED, progressUpdatedHandler);
      livenessModuleRef.current.on(LivenessEvent.TIMEOUT_OCCURRED, timeoutOccurredHandler);
      livenessModuleRef.current.on(LivenessEvent.VERIFICATION_COMPLETE, verificationCompleteHandler);

      // Store handlers for cleanup
      (livenessModuleRef.current as any)._handlers = {
        stepStartedHandler,
        stepPassedHandler,
        progressUpdatedHandler,
        timeoutOccurredHandler,
        verificationCompleteHandler
      };
    }

    return () => {
      // Cleanup event listeners
      if (livenessModuleRef.current && (livenessModuleRef.current as any)._handlers) {
        // We don't have a way to remove handlers without storing them separately, 
        // so we'll skip removal in this simplified implementation
      }
      stopDetection();
    };
  }, [faceDetectionConfig, livenessConfig, onLivenessEvent]);

  // Load models
  const loadModels = useCallback(async (): Promise<void> => {
    if (!faceDetectionServiceRef.current) {
      setErrorMessage('Face detection service not initialized');
      return;
    }

    try {
      await faceDetectionServiceRef.current.loadModels();
      setIsModelsLoaded(true);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error loading models:', error);
      setErrorMessage('Failed to load face detection models');
      throw error;
    }
  }, []);

  // Start detection
  const startDetection = useCallback(async (
    videoElement: HTMLVideoElement, 
    canvasElement: HTMLCanvasElement
  ): Promise<void> => {
    if (!faceDetectionServiceRef.current || !livenessModuleRef.current) {
      setErrorMessage('Services not initialized');
      return;
    }

    if (!faceDetectionServiceRef.current.areModelsLoaded()) {
      setErrorMessage('Models not loaded. Please load models first.');
      return;
    }

    try {
      // Initialize video and canvas
      videoRef.current = videoElement;
      canvasRef.current = canvasElement;

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 720, height: 560 },
        audio: false,
      });

      videoElement.srcObject = stream;
      streamRef.current = stream;

      // Play video
      await videoElement.play();
      
      // Initialize liveness module
      livenessModuleRef.current.initialize();

      // Start detection loop
      setIsCameraActive(true);
      setErrorMessage(null);
      
      const startDetectionLoop = async () => {
        if (!isCameraActive || !videoRef.current || !canvasRef.current) {
          return;
        }

        try {
          // Perform face detection
          const faces = await faceDetectionServiceRef.current!.detectFaces(videoRef.current);
          setDetectedFaces(faces);

          // Update age and gender info if available
          if (faces.length > 0 && faces[0]?.age !== undefined && faces[0]?.gender) {
            setAgeGender({
              age: Math.round(faces[0].age) || 0,
              gender: faces[0].gender || 'unknown',
              probability: faces[0].genderProbability || 0
            });
          }

          // Process with liveness module if the reference exists
          if (livenessModuleRef.current) {
            const livenessResult = livenessModuleRef.current.processFrame(faces);
            
            // Update state based on liveness result
            setStepProgress(livenessResult.progress);
          }

          // Draw detections on canvas
          faceDetectionServiceRef.current!.drawDetections(
            canvasRef.current!,
            faces,
            true,   // draw boxes
            true,   // draw landmarks
            true    // draw expressions
          );

          // Notify detection callback
          onDetection?.(faces);

          // Continue the loop
          animationFrameRef.current = requestAnimationFrame(startDetectionLoop);
        } catch (error) {
          console.error('Error in detection loop:', error);
          setErrorMessage('Error during face detection');
        }
      };

      animationFrameRef.current = requestAnimationFrame(startDetectionLoop);
    } catch (error) {
      console.error('Error starting detection:', error);
      setErrorMessage('Error accessing camera');
    }
  }, [isCameraActive, onDetection]);

  // Stop detection
  const stopDetection = useCallback((): void => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear references
    videoRef.current = null;
    canvasRef.current = null;

    setIsCameraActive(false);
    setDetectedFaces([]);
    setAgeGender(null);
    setStepProgress(0);
  }, []);

  // Retry liveness
  const retryLiveness = useCallback((): void => {
    setErrorMessage(null);
    if (livenessModuleRef.current) {
      livenessModuleRef.current.reset();
    }
  }, []);

  return {
    faceDetectionService: faceDetectionServiceRef.current,
    livenessModule: livenessModuleRef.current,
    isModelsLoaded,
    isCameraActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    stepProgress,
    detectedFaces,
    ageGender,
    errorMessage,
    startDetection,
    stopDetection,
    retryLiveness,
    loadModels,
  };
};