import { DetectedFace } from './FaceDetectionService';

export interface LivenessStep {
  name: string;
  type: 'pose' | 'nod' | 'lookUp' | 'expression';
  timeout: number;
}

export interface LivenessConfig {
  poseThreshold?: number;      // pixels threshold for pose detection
  smileThreshold?: number;     // probability threshold for smile detection
  noseHistoryLength?: number;  // number of frames to keep for motion detection
  nodThreshold?: number;       // pixels: how much the nose must move for nod detection
  lookUpThreshold?: number;    // pixels: how much the nose must move for look-up detection
  steps?: LivenessStep[];
}

export enum LivenessEvent {
  STEP_STARTED = 'stepStarted',
  STEP_PASSED = 'stepPassed',
  STEP_FAILED = 'stepFailed',
  VERIFICATION_COMPLETE = 'verificationComplete',
  VERIFICATION_FAILED = 'verificationFailed',
  TIMEOUT_OCCURRED = 'timeoutOccurred',
  PROGRESS_UPDATED = 'progressUpdated',
}

export interface LivenessEventHandler {
  (event: LivenessEvent, data?: any): void;
}

export interface NosePositionHistory {
  x: number;
  y: number;
  timestamp: number;
}

export class LivenessDetectionModule {
  private config: Required<LivenessConfig>;
  private noseHistory: NosePositionHistory[] = [];
  private currentStepIndex = 0;
  private stepStartTime = 0;
  private shuffledSteps: LivenessStep[] = [];
  private stepProgress = 0;
  private eventHandlers: Map<LivenessEvent, LivenessEventHandler[]> = new Map();
  private baselineY: number | null = null;  // Track baseline Y at step start

  constructor(config: LivenessConfig = {}) {
    this.config = {
      poseThreshold: config.poseThreshold ?? 20,
      smileThreshold: config.smileThreshold ?? 0.6,
      noseHistoryLength: config.noseHistoryLength ?? 15,
      nodThreshold: config.nodThreshold ?? 5,       // Reduced from 8 to 5 for better sensitivity
      lookUpThreshold: config.lookUpThreshold ?? -5, // Reduced from 8 to 5 for better sensitivity
      steps: config.steps ?? [
        { name: "Look Left", type: "pose", timeout: 5000 },
        { name: "Nod", type: "nod", timeout: 6000 },
        { name: "Look Right", type: "pose", timeout: 5000 },
        { name: "Look Up", type: "lookUp", timeout: 6000 },
        { name: "Smile", type: "expression", timeout: 7000 },
      ],
    };
  }

  /**
   * Initializes the liveness check with shuffled steps
   */
  initialize(): void {
    this.shuffledSteps = this.shuffleArray([...this.config.steps]);
    this.currentStepIndex = 0;
    this.stepStartTime = Date.now();
    this.noseHistory = [];
    this.stepProgress = 0;
    this.baselineY = null;

    // Trigger the first step
    this.emit(LivenessEvent.STEP_STARTED, {
      step: this.getCurrentStep(),
      index: this.currentStepIndex,
      total: this.shuffledSteps.length
    });
  }

  /**
   * Processes a frame and evaluates the current liveness step
   */
  processFrame(detectedFaces: DetectedFace[]): { stepPassed: boolean; progress: number; currentStep: LivenessStep | null } {
    const result = {
      stepPassed: false,
      progress: 0,
      currentStep: this.getCurrentStep()
    };

    if (!result.currentStep) {
      return result;
    }

    const elapsed = Date.now() - this.stepStartTime;
    result.progress = Math.min(1, elapsed / result.currentStep.timeout);
    this.stepProgress = result.progress;

    // Emit progress update
    this.emit(LivenessEvent.PROGRESS_UPDATED, {
      progress: this.stepProgress,
      step: result.currentStep,
      elapsed,
      remaining: result.currentStep.timeout - elapsed
    });

    // Check for timeout
    if (elapsed > result.currentStep.timeout) {
      this.emit(LivenessEvent.TIMEOUT_OCCURRED, {
        step: result.currentStep,
        index: this.currentStepIndex
      });
      return result;
    }

    // Process the current step if we have face data
    if (detectedFaces.length > 0) {
      const face = detectedFaces[0]; // Use the first detected face
      result.stepPassed = this.evaluateCurrentStep(face);

      if (result.stepPassed) {
        this.handleStepCompletion();
      }
    }

    return result;
  }

  /**
   * Evaluates if the current step is completed based on face data
   */
  private evaluateCurrentStep(face: DetectedFace): boolean {
    if (!face.landmarks) {
      return false;
    }

    const { landmarks, expressions } = face;
    const nose = landmarks.getNose()[0];
    const jawLeft = landmarks.getJawOutline()[0];
    const jawRight = landmarks.getJawOutline()[16];
    const faceCenter = (jawLeft.x + jawRight.x) / 2;
    const faceWidth = Math.abs(jawRight.x - jawLeft.x);

    // Record nose position for movement detection
    this.pushNosePosition(nose.x, nose.y);

    const currentStep = this.getCurrentStep();
    if (!currentStep) return false;

    switch (currentStep.type) {
      case 'pose':
        if (currentStep.name === "Look Left") {
          const threshold = faceWidth * 0.15;
          return nose.x > faceCenter + threshold;
        } else if (currentStep.name === "Look Right") {
          const threshold = faceWidth * 0.15;
          return nose.x < faceCenter - threshold;
        }
        break;

      case 'nod':
        return this.detectNod();

      case 'lookUp':
        return this.detectLookUp(face);

      case 'expression':
        if (expressions && expressions.happy) {
          return expressions.happy > this.config.smileThreshold;
        }
        break;
    }

    return false;
  }

  /**
   * Handles the completion of a liveness step
   */
  private handleStepCompletion(): void {
    this.emit(LivenessEvent.STEP_PASSED, {
      step: this.getCurrentStep(),
      index: this.currentStepIndex,
      total: this.shuffledSteps.length
    });

    // Move to next step
    this.currentStepIndex++;
    this.noseHistory = []; // Clear nose history after successful completion
    this.baselineY = null;
    this.stepStartTime = Date.now();
    this.stepProgress = 0;

    if (this.currentStepIndex >= this.shuffledSteps.length) {
      // All steps completed
      this.emit(LivenessEvent.VERIFICATION_COMPLETE, {
        steps: this.shuffledSteps,
        totalSteps: this.shuffledSteps.length
      });
    } else {
      // Start the next step
      this.emit(LivenessEvent.STEP_STARTED, {
        step: this.getCurrentStep(),
        index: this.currentStepIndex,
        total: this.shuffledSteps.length
      });
    }
  }

  /**
   * Gets the current step
   */
  getCurrentStep(): LivenessStep | null {
    return this.currentStepIndex < this.shuffledSteps.length 
      ? this.shuffledSteps[this.currentStepIndex] 
      : null;
  }

  /**
   * Gets the current step progress (0 to 1)
   */
  getStepProgress(): number {
    return this.stepProgress;
  }

  /**
   * Gets total number of steps
   */
  getTotalSteps(): number {
    return this.shuffledSteps.length;
  }

  /**
   * Gets the current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Gets remaining time for the current step
   */
  getRemainingTime(): number | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;
    
    const elapsed = Date.now() - this.stepStartTime;
    return Math.max(0, currentStep.timeout - elapsed);
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Records nose position for movement detection
   */
  private pushNosePosition(x: number, y: number): void {
    // Capture baseline on first frame of movement-based steps
    const currentStep = this.getCurrentStep();
    if (currentStep && (currentStep.type === 'nod' || currentStep.type === 'lookUp')) {
      if (this.baselineY === null) {
        this.baselineY = y;
      }
    }

    this.noseHistory.push({ x, y, timestamp: Date.now() });

    if (this.noseHistory.length > this.config.noseHistoryLength) {
      this.noseHistory.shift();
    }
  }

  /**
   * Detects if the user nodded (head goes down then up)
   * Nod pattern: Y increases (down in screen coords) then decreases (up)
   */
  private detectNod(): boolean {
    const minHistoryLength = 4;
    if (this.noseHistory.length < minHistoryLength) return false;

    const yPositions = this.noseHistory.map(pos => pos.y);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const range = maxY - minY;
    const threshold = 6;

    if (range < threshold) return false;

    const maxIndex = yPositions.indexOf(maxY);
    const totalLength = yPositions.length;
    const isNodPattern = maxIndex >= 1 && maxIndex <= totalLength - 2;

    if (!isNodPattern) return false;

    if (this.baselineY !== null) {
      const peakFromStart = maxY - yPositions[0];
      const peakFromEnd = maxY - yPositions[yPositions.length - 1];

      if (peakFromStart < threshold * 0.5 || peakFromEnd < threshold * 0.5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detects if the user looked up
   * When looking up: nose Y decreases (moves up on screen)
   */
  private detectLookUp(face: DetectedFace): boolean {
    if (!face.landmarks) return false;

    const minHistoryLength = 4;
    if (this.noseHistory.length < minHistoryLength) return false;

    const yPositions = this.noseHistory.map(pos => pos.y);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const range = maxY - minY;
    const threshold = 6;

    if (range < threshold) return false;

    const minIndex = yPositions.indexOf(minY);
    const totalLength = yPositions.length;

    if (this.baselineY !== null) {
      const upwardMovement = this.baselineY - minY;

      if (upwardMovement < threshold) return false;

      if (minIndex < totalLength * 0.2) return false;

      return true;
    }

    return false;
  }

  /**
   * Adds an event listener for liveness events
   */
  on(event: LivenessEvent, handler: LivenessEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    this.eventHandlers.get(event)?.push(handler);
  }

  /**
   * Removes an event listener
   */
  off(event: LivenessEvent, handler: LivenessEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emits an event to all registered listeners
   */
  private emit(event: LivenessEvent, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(event, data));
    }
  }

  /**
   * Resets the liveness module to start over
   */
  reset(): void {
    this.initialize();
  }

  /**
   * Restarts the current step (for retries)
   */
  restartCurrentStep(): void {
    this.noseHistory = [];
    this.stepStartTime = Date.now();
    this.stepProgress = 0;
    
    this.emit(LivenessEvent.STEP_STARTED, {
      step: this.getCurrentStep(),
      index: this.currentStepIndex,
      total: this.shuffledSteps.length
    });
  }
}