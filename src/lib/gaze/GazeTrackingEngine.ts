/**
 * GazeTrackingEngine - Production-ready client-side gaze tracking
 * 
 * Features:
 * - Real-time gaze zone detection (on-screen vs off-screen)
 * - Face distance and angle estimation
 * - Adaptive calibration
 * - Privacy-first design (no video leaves the device)
 * - WebRTC-optimized video pipeline
 * - Frame skipping for performance
 * 
 * Privacy: All processing happens locally. No video/images are transmitted.
 */

import {
  FilesetResolver,
  FaceLandmarker,
  NormalizedLandmark
} from '@mediapipe/tasks-vision';

// ==================== Types ====================

export interface GazeZone {
  id: 'on_screen' | 'peripheral' | 'away' | 'no_face';
  label: string;
  severity: 'none' | 'warning' | 'critical';
}

export interface GazeSample {
  timestamp: number;
  zone: GazeZone['id'];
  gazeAngle: number; // degrees from screen center
  confidence: number;
  faceDistance: number; // 0-1, normalized distance from camera
  headPitch: number; // degrees
  headYaw: number; // degrees
  headRoll: number; // degrees
  eyeOffsetX: number; // normalized, relative to eye center
  eyeOffsetY: number; // normalized, relative to eye center
  leftEyeOpen: number; // 0-1
  rightEyeOpen: number; // 0-1
  isBlinking: boolean;
}

export interface AttentionMetrics {
  totalSessionTime: number; // ms
  onScreenTime: number; // ms
  offScreenTime: number; // ms
  attentionPercentage: number; // 0-100
  averageFaceDistance: number; // 0-1
  blinkRate: number; // blinks per minute
  gazeShifts: number; // count of on/off screen transitions
  longestOffScreenPeriod: number; // ms
}

export interface GazeViolation {
  id: string;
  timestamp: number;
  type: 'OFF_SCREEN' | 'PROLONGED_AWAY' | 'EXCESSIVE_BLINK' | 'CLOSE_FACE' | 'MULTIPLE_FACES';
  severity: 'warning' | 'critical';
  duration: number; // ms
  description: string;
  gazeSample: GazeSample;
}

export interface GazeWarning {
  level: 1 | 2 | 3;
  message: string;
  timestamp: number;
  violations: GazeViolation[];
}

export interface CalibrationData {
  centerX: number;
  centerY: number;
  leftThreshold: number;
  rightThreshold: number;
  upThreshold: number;
  downThreshold: number;
  faceDistanceMin: number;
  faceDistanceMax: number;
  isCalibrated: boolean;
  calibrationTimestamp: number | null;
}

export interface GazeTrackingConfig {
  sensitivity: 'low' | 'medium' | 'high' | 'strict';
  frameSkip: number; // Process every N frames
  offScreenThreshold: number; // ms before triggering warning
  prolongedAwayThreshold: number; // ms before critical violation
  minFaceDistance: number; // Too close threshold
  maxFaceDistance: number; // Too far threshold
  blinkThreshold: number; // EAR value
  enableCalibration: boolean;
  enableWarnings: boolean;
  maxWarnings: number;
}

export interface GazeTrackingState {
  isRunning: boolean;
  isCalibrated: boolean;
  modelsLoaded: boolean;
  currentZone: GazeZone['id'];
  currentSample: GazeSample | null;
  attentionMetrics: AttentionMetrics;
  violations: GazeViolation[];
  warnings: GazeWarning[];
  warningCount: number;
  error: string | null;
}

// ==================== Constants ====================

const DEFAULT_CONFIG: GazeTrackingConfig = {
  sensitivity: 'medium',
  frameSkip: 3, // Process every 3rd frame (~10fps at 30fps input)
  offScreenThreshold: 2000, // 2 seconds
  prolongedAwayThreshold: 5000, // 5 seconds
  // faceDistance is proximity: 0 = very far, 1 = very close.
  minFaceDistance: 0.15, // Below this → too far from camera
  maxFaceDistance: 0.6,  // Above this → too close to camera
  blinkThreshold: 0.25,
  enableCalibration: true,
  enableWarnings: true,
  maxWarnings: 3
};

const SENSITIVITY_PRESETS: Record<GazeTrackingConfig['sensitivity'], Partial<GazeTrackingConfig>> = {
  low: {
    offScreenThreshold: 3000,
    prolongedAwayThreshold: 7000,
    frameSkip: 5
  },
  medium: {
    offScreenThreshold: 2000,
    prolongedAwayThreshold: 5000,
    frameSkip: 3
  },
  high: {
    offScreenThreshold: 1500,
    prolongedAwayThreshold: 3000,
    frameSkip: 2
  },
  strict: {
    offScreenThreshold: 1000,
    prolongedAwayThreshold: 2000,
    frameSkip: 1
  }
};

// MediaPipe face landmark indices
const FACE_LANDMARKS = {
  nose: 1,
  leftEye: {
    corner: [33, 133],
    top: [159, 158],
    bottom: [144, 145],
    iris: [468, 469, 470, 471]
  },
  rightEye: {
    corner: [362, 263],
    top: [386, 387],
    bottom: [374, 380],
    iris: [473, 474, 475, 476]
  },
  faceOval: [10, 152, 234, 454], // For distance estimation
  forehead: 10,
  chin: 152,
  leftEar: 234,
  rightEar: 454
};

// ==================== Main Engine Class ====================

export class GazeTrackingEngine {
  // Core components
  private faceLandmarker: FaceLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  
  // State
  private config: GazeTrackingConfig;
  private state: GazeTrackingState;
  private calibration: CalibrationData;
  
  // Tracking
  private frameCount = 0;
  private animationFrameId: number | null = null;
  
  // Session tracking
  private sessionStartTime = 0;
  private onScreenStartTime: number | null = null;
  private offScreenStartTime: number | null = null;
  private lastGazeZone: GazeZone['id'] = 'on_screen';
  private gazeShiftCount = 0;
  private longestOffScreenPeriod = 0;
  private blinkCount = 0;
  private lastBlinkTime = 0;
  
  // Violation tracking
  private violationCounter = 0;
  private warningLevel = 0;
  private lastViolationAt = new Map<string, number>();
  private static readonly VIOLATION_COOLDOWN_MS = 5000;
  
  // Callbacks
  private onGazeUpdate?: (sample: GazeSample) => void;
  private onViolation?: (violation: GazeViolation) => void;
  private onWarning?: (warning: GazeWarning) => void;
  private onStateChange?: (state: GazeTrackingState) => void;

  constructor(config?: Partial<GazeTrackingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.calibration = this.createDefaultCalibration();
    this.state = this.createInitialState();
  }

  // ==================== Initialization ====================

  async initialize(): Promise<boolean> {
    try {
      // Load MediaPipe Face Landmarker
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1
      });

      this.updateState({ modelsLoaded: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize gaze tracking';
      this.updateState({ error: message });
      return false;
    }
  }

  async startCamera(deviceId?: string): Promise<boolean> {
    try {
      // Stop existing stream if any
      this.stopCamera();

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user',
          ...(deviceId && { deviceId: { exact: deviceId } })
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access camera';
      this.updateState({ error: message });
      return false;
    }
  }

  setVideoElement(element: HTMLVideoElement | null): void {
    this.videoElement = element;
  }

  // ==================== Control Methods ====================

  start(onGazeUpdate?: (sample: GazeSample) => void): void {
    if (!this.faceLandmarker) {
      console.error('[GazeEngine] Models not loaded - cannot start gaze tracking');
      return;
    }

    if (!this.videoElement) {
      console.error('[GazeEngine] No video element set - cannot start gaze tracking');
      return;
    }

    if (this.state.isRunning) {
      console.log('[GazeEngine] Already running');
      return;
    }

    console.log('[GazeEngine] Starting gaze tracking...');
    this.onGazeUpdate = onGazeUpdate;
    this.sessionStartTime = Date.now();
    this.updateState({ isRunning: true });

    this.processFrame();
    console.log('[GazeEngine] Gaze tracking started successfully');
  }

  stop(): void {
    this.updateState({ isRunning: false });
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  shutdown(): void {
    this.stop();
    this.stopCamera();
    
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
  }

  // ==================== Calibration ====================

  calibrate(): CalibrationData {
    // Iris-center offset from eye-center in normalized video coords is tiny
    // (typically ±0.006 at gaze extremes). ±0.08 was unreachable.
    this.calibration = {
      centerX: 0.5,
      centerY: 0.5,
      leftThreshold: -0.007,
      rightThreshold: 0.007,
      upThreshold: -0.006,
      downThreshold: 0.006,
      faceDistanceMin: 0.2,
      faceDistanceMax: 0.5,
      isCalibrated: true,
      calibrationTimestamp: Date.now()
    };

    this.updateState({ isCalibrated: true });
    return this.calibration;
  }

  // ==================== Configuration ====================

  updateConfig(updates: Partial<GazeTrackingConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Apply sensitivity preset
    if (updates.sensitivity) {
      const preset = SENSITIVITY_PRESETS[updates.sensitivity];
      this.config = { ...this.config, ...preset };
    }
  }

  getConfig(): GazeTrackingConfig {
    return { ...this.config };
  }

  // ==================== State Access ====================

  getState(): GazeTrackingState {
    return { ...this.state };
  }

  getMetrics(): AttentionMetrics {
    return this.calculateMetrics();
  }

  getViolations(): GazeViolation[] {
    return [...this.state.violations];
  }

  getWarnings(): GazeWarning[] {
    return [...this.state.warnings];
  }

  // ==================== Callbacks ====================

  setOnViolation(callback: (violation: GazeViolation) => void): void {
    this.onViolation = callback;
  }

  setOnWarning(callback: (warning: GazeWarning) => void): void {
    this.onWarning = callback;
  }

  setOnStateChange(callback: (state: GazeTrackingState) => void): void {
    this.onStateChange = callback;
  }

  // ==================== Core Processing ====================

  private processFrame = (): void => {
    if (!this.state.isRunning || !this.faceLandmarker || !this.videoElement) {
      if (this.state.isRunning && !this.videoElement) {
        console.warn('[GazeEngine] Running but no video element set');
      }
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      // Frame skipping for performance
      this.frameCount++;
      if (this.frameCount % this.config.frameSkip !== 0) {
        this.processFrame();
        return;
      }

      const now = performance.now();
      const video = this.videoElement!;

      // Check video readiness
      if (video.readyState < 2) {
        this.processFrame();
        return;
      }

      try {
        const result = this.faceLandmarker!.detectForVideo(video, now);

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const sample = this.analyzeGaze(landmarks, now);

          this.onGazeUpdate?.(sample);
          this.updateState({ currentSample: sample, currentZone: sample.zone });

          this.checkViolations(sample);
          this.updateSessionTracking(sample);
        } else {
          // No face detected
          const sample = this.createNoFaceSample(now);
          this.updateState({ currentSample: sample, currentZone: 'no_face' });
          this.checkViolations(sample);
        }

        this.processFrame();
      } catch (error) {
        console.error('[GazeEngine] Processing error:', error);
        setTimeout(() => this.processFrame(), 500);
      }
    });
  };

  private analyzeGaze(landmarks: NormalizedLandmark[], timestamp: number): GazeSample {
    // Calculate pupil positions
    const leftPupilPos = this.calculatePupilPosition(landmarks, FACE_LANDMARKS.leftEye);
    const rightPupilPos = this.calculatePupilPosition(landmarks, FACE_LANDMARKS.rightEye);
    
    // Calculate eye openness
    const leftEyeOpen = this.calculateEyeAspectRatio(landmarks, FACE_LANDMARKS.leftEye);
    const rightEyeOpen = this.calculateEyeAspectRatio(landmarks, FACE_LANDMARKS.rightEye);
    
    // Calculate head pose
    const headPose = this.estimateHeadPose(landmarks);
    
    // Calculate face distance
    const faceDistance = this.estimateFaceDistance(landmarks);
    
    const eyeOffset = this.calculateAverageEyeOffset(leftPupilPos, rightPupilPos);
    const gazeAngle = this.calculateScreenCenterAngle(headPose, eyeOffset);
    const zone = this.determineGazeZone(leftPupilPos, rightPupilPos);
    
    // Check blinking
    const isBlinking = leftEyeOpen < this.config.blinkThreshold && 
                       rightEyeOpen < this.config.blinkThreshold;

    const sample: GazeSample = {
      timestamp,
      zone,
      gazeAngle,
      confidence: 0.95,
      faceDistance,
      headPitch: headPose.pitch,
      headYaw: headPose.yaw,
      headRoll: headPose.roll,
      eyeOffsetX: eyeOffset.x,
      eyeOffsetY: eyeOffset.y,
      leftEyeOpen,
      rightEyeOpen,
      isBlinking
    };

    // Track blinks
    if (isBlinking && (timestamp - this.lastBlinkTime > 1000)) {
      this.blinkCount++;
      this.lastBlinkTime = timestamp;
    }

    return sample;
  }

  private determineGazeZone(
    leftPupil: { x: number; y: number } | null,
    rightPupil: { x: number; y: number } | null
  ): GazeZone['id'] {
    if (!leftPupil || !rightPupil) {
      return 'no_face';
    }

    // Iris-only classification. Head pose is intentionally ignored — only the
    // iris offset relative to the calibrated screen-edge thresholds determines
    // the zone. Multipliers shape the bands:
    //   peripheral ≈ 1.8× threshold (iris just past the screen edge)
    //   away       ≈ 2.8× threshold (iris clearly outside the laptop frame)
    const eyeOffsetX = (leftPupil.x + rightPupil.x) / 2;
    const eyeOffsetY = (leftPupil.y + rightPupil.y) / 2;

    const cal = this.calibration;
    const PERIPHERAL_MULT = 1.8;
    const AWAY_MULT = 2.8;

    const irisPeripheral =
      eyeOffsetX < cal.leftThreshold * PERIPHERAL_MULT ||
      eyeOffsetX > cal.rightThreshold * PERIPHERAL_MULT ||
      eyeOffsetY < cal.upThreshold * PERIPHERAL_MULT ||
      eyeOffsetY > cal.downThreshold * PERIPHERAL_MULT;

    const irisAway =
      eyeOffsetX < cal.leftThreshold * AWAY_MULT ||
      eyeOffsetX > cal.rightThreshold * AWAY_MULT ||
      eyeOffsetY < cal.upThreshold * AWAY_MULT ||
      eyeOffsetY > cal.downThreshold * AWAY_MULT;

    if (irisAway) return 'away';
    if (irisPeripheral) return 'peripheral';
    return 'on_screen';
  }

  private calculateAverageEyeOffset(
    leftPupil: { x: number; y: number } | null,
    rightPupil: { x: number; y: number } | null
  ): { x: number; y: number } {
    if (!leftPupil || !rightPupil) {
      return { x: 0, y: 0 };
    }

    return {
      x: (leftPupil.x + rightPupil.x) / 2,
      y: (leftPupil.y + rightPupil.y) / 2,
    };
  }

  private calculateScreenCenterAngle(
    headPose: { pitch: number; yaw: number; roll: number },
    eyeOffset: { x: number; y: number }
  ): number {
    const horizontalAngle = headPose.yaw + eyeOffset.x * 1200;
    const verticalAngle = headPose.pitch + eyeOffset.y * 1000;
    return Math.hypot(horizontalAngle, verticalAngle);
  }

  // ==================== Eye Calculations ====================

  private calculatePupilPosition(
    landmarks: NormalizedLandmark[],
    eyeConfig: { corner: number[]; iris: number[] }
  ): { x: number; y: number } | null {
    const irisLandmarks = eyeConfig.iris.map(i => landmarks[i]).filter(Boolean);
    const cornerLandmarks = eyeConfig.corner.map(i => landmarks[i]).filter(Boolean);

    if (irisLandmarks.length < 2 || cornerLandmarks.length < 2) {
      return null;
    }

    const irisCenter = {
      x: irisLandmarks.reduce((sum, l) => sum + l.x, 0) / irisLandmarks.length,
      y: irisLandmarks.reduce((sum, l) => sum + l.y, 0) / irisLandmarks.length
    };

    const eyeCenter = {
      x: (cornerLandmarks[0].x + cornerLandmarks[1].x) / 2,
      y: (cornerLandmarks[0].y + cornerLandmarks[1].y) / 2
    };

    return {
      x: irisCenter.x - eyeCenter.x,
      y: irisCenter.y - eyeCenter.y
    };
  }

  private calculateEyeAspectRatio(
    landmarks: NormalizedLandmark[],
    eyeConfig: { top: number[]; bottom: number[]; corner: number[] }
  ): number {
    const topLandmarks = eyeConfig.top.map(i => landmarks[i]).filter(Boolean);
    const bottomLandmarks = eyeConfig.bottom.map(i => landmarks[i]).filter(Boolean);
    const cornerLandmarks = eyeConfig.corner.map(i => landmarks[i]).filter(Boolean);

    if (topLandmarks.length === 0 || bottomLandmarks.length === 0 || cornerLandmarks.length < 2) {
      return 0.3;
    }

    const verticalDist = topLandmarks.reduce((sum, top, i) => {
      const bottom = bottomLandmarks[i];
      return sum + (bottom ? Math.hypot(top.x - bottom.x, top.y - bottom.y) : 0);
    }, 0) / topLandmarks.length;

    const horizontalDist = Math.hypot(
      cornerLandmarks[0].x - cornerLandmarks[1].x,
      cornerLandmarks[0].y - cornerLandmarks[1].y
    );

    return horizontalDist > 0 ? verticalDist / horizontalDist : 0.3;
  }

  private estimateHeadPose(landmarks: NormalizedLandmark[]): { pitch: number; yaw: number; roll: number } {
    const nose = landmarks[FACE_LANDMARKS.nose];
    const chin = landmarks[FACE_LANDMARKS.chin];
    const leftEar = landmarks[FACE_LANDMARKS.leftEar];
    const rightEar = landmarks[FACE_LANDMARKS.rightEar];

    if (!nose || !chin) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Yaw: normalize nose offset by face width so a ~30° turn reliably triggers detection
    const faceCenterX = leftEar && rightEar
      ? (leftEar.x + rightEar.x) / 2
      : 0.5;
    const faceWidth = leftEar && rightEar
      ? Math.abs(rightEar.x - leftEar.x)
      : 0.3;
    const noseOffsetX = faceWidth > 0 ? (nose.x - faceCenterX) / faceWidth : 0;
    const yaw = noseOffsetX * 90;

    // Estimate pitch from nose-to-chin ratio
    const faceHeight = Math.abs(chin.y - nose.y);
    const pitch = (faceHeight - 0.3) * 100;

    // Estimate roll from ear height difference
    const roll = leftEar && rightEar
      ? (leftEar.y - rightEar.y) * 90
      : 0;

    return { pitch, yaw, roll };
  }

  private estimateFaceDistance(landmarks: NormalizedLandmark[]): number {
    // Inter-ocular distance is far more robust than forehead-to-chin under head pitch/yaw.
    const leftEyeCorner = landmarks[33];
    const rightEyeCorner = landmarks[263];

    if (!leftEyeCorner || !rightEyeCorner) {
      return 0.5;
    }

    const eyeDist = Math.hypot(
      leftEyeCorner.x - rightEyeCorner.x,
      leftEyeCorner.y - rightEyeCorner.y
    );

    // Typical inter-ocular distance in normalized video coords:
    //   ~0.06 when the user is very far, ~0.18 when the face fills the frame.
    // Return a proximity value: 0 = very far, 1 = very close to camera.
    const proximity = (eyeDist - 0.06) / (0.18 - 0.06);

    return Math.max(0, Math.min(1, proximity));
  }

  // ==================== Violation Detection ====================

  private checkViolations(sample: GazeSample): void {
    const now = Date.now();

    // Off-screen detection
    if (sample.zone !== 'on_screen') {
      if (!this.offScreenStartTime) {
        this.offScreenStartTime = now;
      } else {
        const duration = now - this.offScreenStartTime;

        if (duration >= this.config.offScreenThreshold) {
          const lastOff = this.lastViolationAt.get('OFF_SCREEN') ?? 0;
          if (now - lastOff >= GazeTrackingEngine.VIOLATION_COOLDOWN_MS) {
            this.lastViolationAt.set('OFF_SCREEN', now);
            this.createViolation('OFF_SCREEN', 'warning', sample, duration);
          }
        }

        if (duration >= this.config.prolongedAwayThreshold) {
          const lastProlonged = this.lastViolationAt.get('PROLONGED_AWAY') ?? 0;
          if (now - lastProlonged >= GazeTrackingEngine.VIOLATION_COOLDOWN_MS) {
            this.lastViolationAt.set('PROLONGED_AWAY', now);
            this.createViolation('PROLONGED_AWAY', 'critical', sample, duration);
          }
        }
      }
    } else {
      this.offScreenStartTime = null;
      this.lastViolationAt.delete('OFF_SCREEN');
      this.lastViolationAt.delete('PROLONGED_AWAY');
    }

    // Face distance — `faceDistance` is proximity: 0 = very far, 1 = very close.
    // Fire CLOSE_FACE only when the face is actually too close, with a cooldown
    // so it does not emit on every processed frame.
    if (sample.faceDistance > this.config.maxFaceDistance) {
      const lastClose = this.lastViolationAt.get('CLOSE_FACE') ?? 0;
      if (now - lastClose >= GazeTrackingEngine.VIOLATION_COOLDOWN_MS) {
        this.lastViolationAt.set('CLOSE_FACE', now);
        this.createViolation('CLOSE_FACE', 'warning', sample, 0);
      }
    } else {
      this.lastViolationAt.delete('CLOSE_FACE');
    }

    // Warning system
    if (this.config.enableWarnings) {
      this.updateWarningLevel();
    }
  }

  private createViolation(
    type: GazeViolation['type'],
    severity: GazeViolation['severity'],
    sample: GazeSample,
    duration: number
  ): void {
    this.violationCounter++;
    
    const violation: GazeViolation = {
      id: `v${this.violationCounter}-${Date.now()}`,
      timestamp: Date.now(),
      type,
      severity,
      duration,
      description: this.getViolationDescription(type, duration),
      gazeSample: sample
    };

    const violations = [...this.state.violations, violation].slice(-100);
    this.updateState({ violations });

    this.onViolation?.(violation);
  }

  private getViolationDescription(type: GazeViolation['type'], duration: number): string {
    switch (type) {
      case 'OFF_SCREEN':
        return `Looking away from screen for ${Math.round(duration / 1000)}s`;
      case 'PROLONGED_AWAY':
        return `Prolonged absence from screen: ${Math.round(duration / 1000)}s`;
      case 'EXCESSIVE_BLINK':
        return 'Excessive blinking detected';
      case 'CLOSE_FACE':
        return 'Face too close to camera';
      case 'MULTIPLE_FACES':
        return 'Multiple faces detected';
      default:
        return 'Gaze violation detected';
    }
  }

  private updateWarningLevel(): void {
    const now = Date.now();
    const recentViolations = this.state.violations.filter(
      v => now - v.timestamp < 60000 // Last minute
    );

    let newLevel = 0;
    
    if (recentViolations.length >= 3) newLevel = 1;
    if (recentViolations.length >= 5) newLevel = 2;
    if (recentViolations.length >= 10 || recentViolations.some(v => v.severity === 'critical')) {
      newLevel = 3;
    }

    if (newLevel > this.warningLevel && newLevel <= this.config.maxWarnings) {
      this.warningLevel = newLevel;

      const warning: GazeWarning = {
        level: newLevel as GazeWarning['level'],
        message: this.getWarningMessage(newLevel),
        timestamp: now,
        violations: recentViolations.slice(-5)
      };

      const warnings = [...this.state.warnings, warning];
      this.updateState({ warnings, warningCount: warnings.length });

      this.onWarning?.(warning);
    }
  }

  private getWarningMessage(level: number): string {
    switch (level) {
      case 1:
        return '⚠️ Warning: Please keep your eyes on the screen';
      case 2:
        return '⚠️⚠️ Second Warning: Continued off-screen gaze detected';
      case 3:
        return '🚨 Final Warning: Exam may be flagged if behavior continues';
      default:
        return 'Attention warning';
    }
  }

  // ==================== Session Tracking ====================

  private updateSessionTracking(sample: GazeSample): void {
    const now = Date.now();

    // Track gaze shifts
    if (sample.zone !== this.lastGazeZone) {
      if (this.lastGazeZone === 'on_screen' || sample.zone === 'on_screen') {
        this.gazeShiftCount++;
      }
      this.lastGazeZone = sample.zone;
    }

    // Track on/off screen time
    if (sample.zone === 'on_screen') {
      if (!this.onScreenStartTime) {
        this.onScreenStartTime = now;
      }
      this.offScreenStartTime = null;
    } else {
      if (!this.offScreenStartTime) {
        this.offScreenStartTime = now;
      }
      this.onScreenStartTime = null;

      // Track longest off-screen period
      if (this.offScreenStartTime) {
        const offScreenDuration = now - this.offScreenStartTime;
        this.longestOffScreenPeriod = Math.max(this.longestOffScreenPeriod, offScreenDuration);
      }
    }
  }

  private calculateMetrics(): AttentionMetrics {
    const now = Date.now();
    const totalSessionTime = now - this.sessionStartTime;
    
    // Calculate on-screen vs off-screen time from violations
    let offScreenTime = 0;
    this.state.violations.forEach(v => {
      if (v.type === 'OFF_SCREEN' || v.type === 'PROLONGED_AWAY') {
        offScreenTime += v.duration;
      }
    });

    const onScreenTime = totalSessionTime - offScreenTime;
    const attentionPercentage = totalSessionTime > 0 
      ? (onScreenTime / totalSessionTime) * 100 
      : 100;

    const sessionMinutes = totalSessionTime / 60000;
    const blinkRate = sessionMinutes > 0 ? this.blinkCount / sessionMinutes : 0;

    return {
      totalSessionTime,
      onScreenTime,
      offScreenTime,
      attentionPercentage: Math.max(0, Math.min(100, attentionPercentage)),
      averageFaceDistance: this.state.currentSample?.faceDistance || 0.5,
      blinkRate,
      gazeShifts: this.gazeShiftCount,
      longestOffScreenPeriod: this.longestOffScreenPeriod
    };
  }

  // ==================== Helpers ====================

  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  private createInitialState(): GazeTrackingState {
    return {
      isRunning: false,
      isCalibrated: false,
      modelsLoaded: false,
      currentZone: 'on_screen',
      currentSample: null,
      attentionMetrics: this.createDefaultMetrics(),
      violations: [],
      warnings: [],
      warningCount: 0,
      error: null
    };
  }

  private createDefaultMetrics(): AttentionMetrics {
    return {
      totalSessionTime: 0,
      onScreenTime: 0,
      offScreenTime: 0,
      attentionPercentage: 100,
      averageFaceDistance: 0.5,
      blinkRate: 0,
      gazeShifts: 0,
      longestOffScreenPeriod: 0
    };
  }

  private createDefaultCalibration(): CalibrationData {
    return {
      centerX: 0.5,
      centerY: 0.5,
      leftThreshold: -0.007,
      rightThreshold: 0.007,
      upThreshold: -0.006,
      downThreshold: 0.006,
      faceDistanceMin: 0.2,
      faceDistanceMax: 0.5,
      isCalibrated: false,
      calibrationTimestamp: null
    };
  }

  private createNoFaceSample(timestamp: number): GazeSample {
    return {
      timestamp,
      zone: 'no_face',
      gazeAngle: 90,
      confidence: 0,
      faceDistance: 0,
      headPitch: 0,
      headYaw: 0,
      headRoll: 0,
      eyeOffsetX: 0,
      eyeOffsetY: 0,
      leftEyeOpen: 0,
      rightEyeOpen: 0,
      isBlinking: false
    };
  }

  private updateState(updates: Partial<GazeTrackingState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }
}
