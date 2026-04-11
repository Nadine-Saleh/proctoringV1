# Gaze Tracking Module - Production Documentation

## 📋 Overview

A production-ready, privacy-first gaze tracking system for academic proctoring. Built with MediaPipe Face Landmarker and optimized for real-time performance in web browsers.

### Key Features
✅ Real-time gaze zone detection (on-screen vs off-screen)  
✅ Face distance and head pose estimation  
✅ Progressive warning system with escalation  
✅ Attention metrics and analytics  
✅ Privacy-first design (all processing client-side)  
✅ Frame skipping for performance optimization  
✅ Adaptive calibration system  
✅ Comprehensive violation logging  

---

## 🏗️ Architecture

```
src/
├── lib/gaze/
│   └── GazeTrackingEngine.ts    # Core engine (framework-agnostic)
├── hooks/
│   └── useGazeTracking.ts       # React hook wrapper
└── components/
    └── GazeTrackingOverlay.tsx  # UI component
```

### Design Principles

1. **Privacy-First**: No video/images leave the device. All processing is local.
2. **Performance**: Frame skipping, GPU acceleration, optimized landmark selection
3. **Modularity**: Engine is framework-agnostic, hook provides React integration
4. **Configurable**: Sensitivity levels, thresholds, and behavior customization
5. **Observable**: Comprehensive metrics, events, and callbacks

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { useGazeTracking } from './hooks/useGazeTracking';

function ExamPage() {
  const {
    isRunning,
    currentSample,
    metrics,
    violations,
    warningLevel,
    start,
    stop,
    videoRef
  } = useGazeTracking({
    sensitivity: 'medium',
    enableWarnings: true
  });

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <button onClick={start}>Start Gaze Tracking</button>
      <button onClick={stop}>Stop</button>
      
      {warningLevel > 0 && (
        <WarningBanner level={warningLevel} />
      )}
      
      <MetricsDisplay metrics={metrics} />
    </div>
  );
}
```

### With Full Overlay Component

```typescript
import { useGazeTracking } from './hooks/useGazeTracking';
import { GazeTrackingOverlay } from './components/GazeTrackingOverlay';

function ExamPage() {
  const gazeTracking = useGazeTracking();

  return (
    <div>
      <video ref={gazeTracking.videoRef} autoPlay muted playsInline />
      <GazeTrackingOverlay {...gazeTracking} />
    </div>
  );
}
```

---

## ⚙️ Configuration

### GazeTrackingConfig Options

```typescript
interface GazeTrackingConfig {
  sensitivity: 'low' | 'medium' | 'high' | 'strict';
  frameSkip: number;                    // Process every N frames (default: 3)
  offScreenThreshold: number;           // ms before warning (default: 2000)
  prolongedAwayThreshold: number;       // ms before critical (default: 5000)
  minFaceDistance: number;              // Too close threshold (default: 0.15)
  maxFaceDistance: number;              // Too far threshold (default: 0.6)
  blinkThreshold: number;               // EAR value (default: 0.25)
  enableCalibration: boolean;           // Auto-calibrate on start
  enableWarnings: boolean;              // Show progressive warnings
  maxWarnings: number;                  // Max warnings before flagging
}
```

### Sensitivity Presets

| Preset   | Off-Screen Threshold | Prolonged Away | Frame Skip | Use Case                    |
|----------|----------------------|----------------|------------|-----------------------------|
| Low      | 3000ms               | 7000ms         | 5          | Casual monitoring           |
| Medium   | 2000ms               | 5000ms         | 3          | Standard exams (default)    |
| High     | 1500ms               | 3000ms         | 2          | High-stakes exams           |
| Strict   | 1000ms               | 2000ms         | 1          | Certification exams         |

---

## 📊 Data Structures

### GazeSample

```typescript
interface GazeSample {
  timestamp: number;          // Unix timestamp (ms)
  zone: 'on-screen' | 'left' | 'right' | 'up' | 'down' | 'away';
  confidence: number;         // 0-1 detection confidence
  faceDistance: number;       // 0-1 normalized distance
  headPitch: number;          // degrees (-90 to 90)
  headYaw: number;            // degrees (-90 to 90)
  headRoll: number;           // degrees (-90 to 90)
  leftEyeOpen: number;        // 0-1 eye aspect ratio
  rightEyeOpen: number;       // 0-1 eye aspect ratio
  isBlinking: boolean;        // Current blink state
}
```

### AttentionMetrics

```typescript
interface AttentionMetrics {
  totalSessionTime: number;         // Total tracking time (ms)
  onScreenTime: number;             // Time looking at screen (ms)
  offScreenTime: number;            // Time looking away (ms)
  attentionPercentage: number;      // 0-100% attention score
  averageFaceDistance: number;      // 0-1 average distance
  blinkRate: number;                // Blinks per minute
  gazeShifts: number;               // On/off screen transitions
  longestOffScreenPeriod: number;   // Longest away period (ms)
}
```

### GazeViolation

```typescript
interface GazeViolation {
  id: string;
  timestamp: number;
  type: 'OFF_SCREEN' | 'PROLONGED_AWAY' | 'EXCESSIVE_BLINK' | 'CLOSE_FACE' | 'MULTIPLE_FACES';
  severity: 'warning' | 'critical';
  duration: number;               // ms (for time-based violations)
  description: string;
  gazeSample: GazeSample;         // Sample at time of violation
}
```

### GazeWarning

```typescript
interface GazeWarning {
  level: 1 | 2 | 3;               // Progressive warning level
  message: string;                 // User-facing message
  timestamp: number;
  violations: GazeViolation[];    // Triggering violations
}
```

---

## 🎯 Gaze Zone Detection

### Zone Classification

The system classifies gaze into 6 zones based on head pose and pupil position:

| Zone        | Head Yaw    | Head Pitch  | Severity  | Description                    |
|-------------|-------------|-------------|-----------|--------------------------------|
| on-screen   | -25° to 25° | -20° to 25° | none      | Looking at exam screen         |
| left        | < -25°      | any         | warning   | Looking left of screen         |
| right       | > 25°       | any         | warning   | Looking right of screen        |
| up          | any         | < -20°      | warning   | Looking up (ceiling)           |
| down        | any         | > 25°       | warning   | Looking down (desk/phone)      |
| away        | no face     | no face     | critical  | Face not detected              |

### Calibration

The system auto-calibrates on start, setting thresholds based on:
- Initial face detection position
- Estimated optimal pupil position ranges
- Face distance bounds

Manual calibration can be triggered via `calibrate()` method.

---

## ⚠️ Warning System

### Progressive Escalation

The warning system escalates based on recent violation count (last 60 seconds):

| Level | Violations | Message                                  | Action                           |
|-------|------------|------------------------------------------|----------------------------------|
| 1     | ≥ 3        | "Please keep your eyes on the screen"    | Yellow banner                    |
| 2     | ≥ 5        | "Continued off-screen gaze detected"     | Orange banner, stronger message  |
| 3     | ≥ 10       | "Exam may be flagged"                    | Red banner, critical warning     |

Warnings are tracked and can be cleared via `clearWarnings()`.

---

## 🔧 API Reference

### GazeTrackingEngine

```typescript
class GazeTrackingEngine {
  // Initialization
  async initialize(): Promise<boolean>;
  async startCamera(deviceId?: string): Promise<boolean>;
  setVideoElement(element: HTMLVideoElement | null): void;
  
  // Control
  start(onGazeUpdate?: (sample: GazeSample) => void): void;
  stop(): void;
  shutdown(): void;
  calibrate(): CalibrationData;
  
  // Configuration
  updateConfig(updates: Partial<GazeTrackingConfig>): void;
  getConfig(): GazeTrackingConfig;
  
  // State Access
  getState(): GazeTrackingState;
  getMetrics(): AttentionMetrics;
  getViolations(): GazeViolation[];
  getWarnings(): GazeWarning[];
  
  // Callbacks
  setOnViolation(callback: (violation: GazeViolation) => void): void;
  setOnWarning(callback: (warning: GazeWarning) => void): void;
  setOnStateChange(callback: (state: GazeTrackingState) => void): void;
}
```

### useGazeTracking Hook

```typescript
function useGazeTracking(config?: Partial<GazeTrackingConfig>): {
  // State
  isRunning: boolean;
  isCalibrated: boolean;
  modelsLoaded: boolean;
  currentSample: GazeSample | null;
  currentZone: string;
  
  // Metrics
  metrics: AttentionMetrics;
  violations: GazeViolation[];
  warnings: GazeWarning[];
  warningCount: number;
  warningLevel: number;
  latestWarning: GazeWarning | null;
  
  // Controls
  start: () => Promise<void>;
  stop: () => void;
  calibrate: () => void;
  updateConfig: (config: Partial<GazeTrackingConfig>) => void;
  clearViolations: () => void;
  clearWarnings: () => void;
  
  // Status
  error: string | null;
  videoRef: (element: HTMLVideoElement | null) => void;
}
```

---

## 🎨 Components

### GazeTrackingOverlay

Full-featured UI component with:
- Real-time gaze zone indicator
- Attention score with progress bar
- Detailed metrics (session time, on/off screen, blink rate)
- Violation history with expand/collapse
- Progressive warning banners
- Calibration controls

**Props:** See `GazeTrackingOverlayProps` interface in component file.

---

## 🔒 Privacy & Security

### Data Handling

✅ **All processing is client-side** - No video leaves the device  
✅ **No images stored** - Only numerical metrics are tracked  
✅ **No external APIs** - MediaPipe runs locally in browser  
✅ **Session-only data** - Metrics reset on page refresh (unless persisted by host app)  

### Compliance Considerations

- GDPR: Gaze data is biometric - inform users before tracking
- FERPA: Suitable for educational proctoring with consent
- Accessibility: Provide alternative for users with disabilities

---

## ⚡ Performance

### Optimization Strategies

1. **Frame Skipping**: Process every Nth frame (default: 3 = ~10fps at 30fps input)
2. **GPU Acceleration**: MediaPipe uses WebGL by default
3. **RequestAnimationFrame**: Smooth, non-blocking processing loop
4. **Early Exits**: Skip processing if video not ready or engine stopped

### Browser Compatibility

| Browser        | Version | Support |
|----------------|---------|---------|
| Chrome         | 90+     | ✅ Full |
| Firefox        | 88+     | ✅ Full |
| Safari         | 15+     | ✅ Full |
| Edge           | 90+     | ✅ Full |
| Mobile Safari  | 15+     | ⚠️ Limited |

### Resource Usage

- **CPU**: ~5-15% (depends on frame skip setting)
- **GPU**: ~10-20% (WebGL acceleration)
- **Memory**: ~100-200MB (MediaPipe models)
- **Network**: Only initial model download (~5MB, cached)

---

## 🧪 Testing

### Unit Tests

```typescript
import { GazeTrackingEngine } from './lib/gaze/GazeTrackingEngine';

describe('GazeTrackingEngine', () => {
  let engine: GazeTrackingEngine;

  beforeEach(() => {
    engine = new GazeTrackingEngine();
  });

  test('initializes successfully', async () => {
    const result = await engine.initialize();
    expect(result).toBe(true);
    expect(engine.getState().modelsLoaded).toBe(true);
  });

  test('detects off-screen gaze', () => {
    // Mock landmarks for looking left
    const mockLandmarks = createMockLandmarks({ yaw: -30 });
    const sample = engine.analyzeGaze(mockLandmarks, Date.now());
    expect(sample.zone).toBe('left');
  });
});
```

### Integration Testing

```typescript
// Test with real camera
test('full tracking session', async () => {
  const { result } = renderHook(() => useGazeTracking());
  
  await result.current.start();
  expect(result.current.isRunning).toBe(true);
  
  // Simulate looking away
  // ... (requires mock video feed)
  
  result.current.stop();
  expect(result.current.metrics.offScreenTime).toBeGreaterThan(0);
});
```

---

## 🐛 Troubleshooting

### Common Issues

**Camera not starting:**
- Check browser permissions
- Ensure no other app is using camera
- Try different deviceId via `startCamera(deviceId)`

**Models not loading:**
- Check internet connection (models loaded from CDN)
- Verify CDN URL is accessible
- Check browser console for CORS errors

**Poor detection accuracy:**
- Ensure good lighting
- Face should be clearly visible
- Avoid extreme angles
- Run calibration for user-specific thresholds

**Performance issues:**
- Increase `frameSkip` in config
- Reduce video resolution
- Close other browser tabs/apps
- Check GPU acceleration is enabled

---

## 📈 Future Enhancements

- [ ] WebWorker integration for non-blocking processing
- [ ] Custom model fine-tuning for specific demographics
- [ ] Multi-face tracking support
- [ ] Gaze heatmap visualization
- [ ] Export metrics to CSV/JSON
- [ ] Real-time proctor dashboard integration
- [ ] Anti-spoofing detection (photos, videos)
- [ ] Eye tracking for reading pattern analysis

---

## 📄 License

This module is part of the ProctoringV2 application. All rights reserved.

---

## 👥 Support

For issues, questions, or contributions:
- Review this documentation
- Check existing issues in repository
- Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-03  
**Maintained By**: Senior Engineering Team
