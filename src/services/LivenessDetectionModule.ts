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
  private baselineX: number | null = null;  // Track baseline X at step start

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
    this.baselineX = null;
    
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

    // Debug logging for pose detection
    if (currentStep.type === 'pose') {
      const noseOffset = nose.x - faceCenter;
      console.log('[LivenessModule] Pose -', currentStep.name, '- noseOffset:', noseOffset.toFixed(1), 'faceWidth:', faceWidth.toFixed(1), 'threshold:', (faceWidth * 0.15).toFixed(1));
    }

    switch (currentStep.type) {
      case 'pose':
        if (currentStep.name === "Look Left") {
          // When turning head left, nose moves right in camera view (larger x values)
          // Use percentage of face width for better scaling
          const threshold = faceWidth * 0.15; // 15% of face width
          return nose.x > faceCenter + threshold;
        } else if (currentStep.name === "Look Right") {
          // When turning head right, nose moves left in camera view (smaller x values)
          const threshold = faceWidth * 0.15; // 15% of face width
          return nose.x < faceCenter - threshold;
        }
        break;

      case 'nod':
        return this.detectNod();

      case 'lookUp':
        return this.detectLookUp(face);

      case 'expression':
        if (expressions && expressions.happy) {
          const passed = expressions.happy > this.config.smileThreshold;
          console.log('[LivenessModule] Smile - happy:', expressions.happy.toFixed(2), 'threshold:', this.config.smileThreshold, passed ? 'PASSED ✓' : 'FAILED ✗');
          return passed;
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
    this.baselineX = null;
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
        this.baselineX = x;
        console.log('[LivenessModule] Baseline captured:', { x: x.toFixed(1), y: y.toFixed(1) });
      }
    }

    this.noseHistory.push({
      x,
      y,
      timestamp: Date.now()
    });

    if (this.noseHistory.length > this.config.noseHistoryLength) {
      this.noseHistory.shift();
    }
    
    // Debug logging for current step
    if (currentStep && (currentStep.type === 'nod' || currentStep.type === 'lookUp')) {
      console.log('[LivenessModule] Recording position:', { x: x.toFixed(1), y: y.toFixed(1), historyLength: this.noseHistory.length, baselineY: this.baselineY?.toFixed(1) });
    }
  }

  /**
   * Detects if the user nodded (head goes down then up)
   * Nod pattern: Y increases (down in screen coords) then decreases (up)
   */
  private detectNod(): boolean {
    // Need at least 4 frames to detect a nod pattern (more responsive)
    const minHistoryLength = 4;
    if (this.noseHistory.length < minHistoryLength) return false;

    // Get the Y positions from the nose history
    const yPositions = this.noseHistory.map(pos => pos.y);

    // Find min and max Y values
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const range = maxY - minY;

    // Use a lenient threshold
    const threshold = 6; // pixels - reduced for faster detection

    console.log('[LivenessModule] Nod - Y values:', yPositions.map(y => y.toFixed(1)).join(', '));
    console.log('[LivenessModule] Nod - range:', range.toFixed(1), 'minY:', minY.toFixed(1), 'maxY:', maxY.toFixed(1), 'baselineY:', this.baselineY?.toFixed(1));

    // Need significant movement
    if (range < threshold) {
      console.log('[LivenessModule] Nod: FAILED - range', range.toFixed(1), '< threshold', threshold);
      return false;
    }

    // Find the peak (maximum Y = lowest point on screen = head tilted down)
    const maxIndex = yPositions.indexOf(maxY);
    const totalLength = yPositions.length;

    // For a nod, peak should be somewhere in the middle (not at the very start or end)
    // More lenient: allow peak to be anywhere except the very edges
    const isNodPattern = maxIndex >= 1 && maxIndex <= totalLength - 2;

    console.log('[LivenessModule] Nod - maxIndex:', maxIndex, 'totalLength:', totalLength, 'isNodPattern:', isNodPattern);

    if (!isNodPattern) {
      console.log('[LivenessModule] Nod: FAILED - peak not in middle');
      return false;
    }

    // Check that we went down from baseline and came back up
    if (this.baselineY !== null) {
      // The peak should be significantly lower (higher Y) than both start and end
      const peakFromStart = maxY - yPositions[0];
      const peakFromEnd = maxY - yPositions[yPositions.length - 1];

      console.log('[LivenessModule] Nod - peakFromStart:', peakFromStart.toFixed(1), 'peakFromEnd:', peakFromEnd.toFixed(1));

      // Both should be positive (went down from start, came back up to end)
      if (peakFromStart < threshold * 0.5 || peakFromEnd < threshold * 0.5) {
        console.log('[LivenessModule] Nod: FAILED - did not return to baseline');
        return false;
      }
    }

    console.log('[LivenessModule] Nod: PASSED ✓');
    return true;
  }

  /**
   * Detects if the user looked up
   * When looking up: nose Y decreases (moves up on screen)
   */
  private detectLookUp(face: DetectedFace): boolean {
    if (!face.landmarks) return false;

    // Need at least 4 frames to detect lookUp pattern (more responsive)
    const minHistoryLength = 4;
    if (this.noseHistory.length < minHistoryLength) return false;

    // Get the Y positions from the nose history
    const yPositions = this.noseHistory.map(pos => pos.y);

    // Find min and max Y values
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const range = maxY - minY;

    // Use a lenient threshold - looking up means nose goes UP (smaller Y)
    const threshold = 6; // pixels - reduced for faster detection

    console.log('[LivenessModule] LookUp - Y values:', yPositions.map(y => y.toFixed(1)).join(', '));
    console.log('[LivenessModule] LookUp - range:', range.toFixed(1), 'minY:', minY.toFixed(1), 'maxY:', maxY.toFixed(1), 'baselineY:', this.baselineY?.toFixed(1));

    // Need significant movement
    if (range < threshold) {
      console.log('[LivenessModule] LookUp: FAILED - range', range.toFixed(1), '< threshold', threshold);
      return false;
    }

    // Find the minimum (highest point on screen = head tilted up)
    const minIndex = yPositions.indexOf(minY);
    const totalLength = yPositions.length;

    console.log('[LivenessModule] LookUp - minIndex:', minIndex, 'totalLength:', totalLength);

    // Check for upward movement from baseline
    if (this.baselineY !== null) {
      const upwardMovement = this.baselineY - minY;
      console.log('[LivenessModule] LookUp - upwardMovement:', upwardMovement.toFixed(1));

      // Need significant upward movement from baseline
      if (upwardMovement < threshold) {
        console.log('[LivenessModule] LookUp: FAILED - not enough upward movement');
        return false;
      }

      // Check that we sustained the upward position (not just a quick flick)
      // More lenient: minimum should be in the latter part of history
      if (minIndex < totalLength * 0.2) {
        console.log('[LivenessModule] LookUp: FAILED - upward position not sustained');
        return false;
      }

      console.log('[LivenessModule] LookUp: PASSED ✓');
      return true;
    }

    console.log('[LivenessModule] LookUp: FAILED - no baseline');
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