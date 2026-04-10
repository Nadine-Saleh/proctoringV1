# Gaze Tracking Integration Guide

## Quick Integration into Exam Page

This guide shows how to integrate the new gaze tracking module into the existing Exam page.

### Step 1: Import the Hook and Component

```typescript
// src/pages/student/Exam.tsx
import { useGazeTracking } from '../../hooks/useGazeTracking';
import { GazeTrackingOverlay } from '../../components/GazeTrackingOverlay';
```

### Step 2: Initialize the Hook

```typescript
export const Exam = () => {
  // ... existing state and hooks

  // Add gaze tracking
  const gazeTracking = useGazeTracking({
    sensitivity: 'medium',
    enableWarnings: true,
    enableCalibration: true,
    offScreenThreshold: 2000,
    prolongedAwayThreshold: 5000
  });

  // Start gaze tracking when exam starts
  useEffect(() => {
    if (examStarted && !gazeTracking.isRunning) {
      gazeTracking.start();
    }
  }, [examStarted]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      gazeTracking.stop();
    };
  }, []);
```

### Step 3: Add Video Ref

```typescript
// Combine with existing video ref or create new one
const setGazeVideoRef = useCallback((element: HTMLVideoElement | null) => {
  gazeTracking.videoRef(element);
  // Also pass to other hooks if needed
}, [gazeTracking.videoRef]);
```

### Step 4: Render the Overlay

```typescript
// In the proctoring sidebar
<div className="p-6 border-b border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Monitor</h3>
  
  {/* Video element */}
  <video
    ref={setGazeVideoRef}
    autoPlay
    muted
    playsInline
    className="w-full h-full object-cover"
  />

  {/* Gaze Tracking Overlay */}
  <GazeTrackingOverlay
    isRunning={gazeTracking.isRunning}
    isCalibrated={gazeTracking.isCalibrated}
    modelsLoaded={gazeTracking.modelsLoaded}
    currentSample={gazeTracking.currentSample}
    currentZone={gazeTracking.currentZone}
    metrics={gazeTracking.metrics}
    violations={gazeTracking.violations}
    warnings={gazeTracking.warnings}
    warningLevel={gazeTracking.warningLevel}
    latestWarning={gazeTracking.latestWarning}
    error={gazeTracking.error}
    onStart={gazeTracking.start}
    onStop={gazeTracking.stop}
    onCalibrate={gazeTracking.calibrate}
    onClearViolations={gazeTracking.clearViolations}
    onClearWarnings={gazeTracking.clearWarnings}
  />
</div>
```

### Step 5: Handle Violations (Optional)

```typescript
// Auto-submit exam if too many violations
useEffect(() => {
  if (gazeTracking.warningLevel >= 3) {
    // Flag exam or notify proctor
    console.warn('Exam flagged for review:', gazeTracking.violations);
  }
}, [gazeTracking.warningLevel]);

// Include metrics in exam submission
const handleSubmit = useCallback(() => {
  const examData = {
    answers,
    gazeMetrics: gazeTracking.metrics,
    violations: gazeTracking.violations,
    attentionScore: gazeTracking.metrics.attentionPercentage
  };
  
  // Submit to backend
  navigate('/results');
}, [answers, gazeTracking.metrics, gazeTracking.violations]);
```

---

## Full Example: Minimal Integration

```typescript
import { useEffect } from 'react';
import { useGazeTracking } from '../../hooks/useGazeTracking';
import { GazeTrackingOverlay } from '../../components/GazeTrackingOverlay';

export const ExamWithGazeTracking = () => {
  const gazeTracking = useGazeTracking();

  useEffect(() => {
    gazeTracking.start();
    return () => gazeTracking.stop();
  }, []);

  return (
    <div className="exam-container">
      <video
        ref={gazeTracking.videoRef}
        autoPlay
        muted
        playsInline
        className="hidden" // Hidden if you don't want to show it
      />
      
      {/* Warning banner appears automatically */}
      
      {/* Sidebar with metrics */}
      <aside>
        <GazeTrackingOverlay {...gazeTracking} />
      </aside>
      
      {/* Exam content */}
      <main>{/* ... */}</main>
    </div>
  );
};
```

---

## Backend Integration (Example)

### Submit Gaze Metrics with Exam

```typescript
// When submitting exam
const submitExam = async () => {
  const response = await fetch('/api/exams/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examId: currentExam.id,
      answers,
      timeRemaining,
      // Gaze tracking data
      proctoring: {
        attentionScore: gazeTracking.metrics.attentionPercentage,
        totalViolations: gazeTracking.violations.length,
        warningLevel: gazeTracking.warningLevel,
        offScreenTime: gazeTracking.metrics.offScreenTime,
        violations: gazeTracking.violations.map(v => ({
          type: v.type,
          severity: v.severity,
          timestamp: v.timestamp,
          duration: v.duration
        }))
      }
    })
  });

  return response.json();
};
```

### Flag Suspicious Exams

```typescript
// Backend logic (Node.js example)
app.post('/api/exams/submit', async (req, res) => {
  const { proctoring } = req.body;
  
  let flagStatus = 'clean';
  
  if (proctoring.attentionScore < 70) {
    flagStatus = 'review';
  }
  
  if (proctoring.warningLevel >= 3 || proctoring.totalViolations > 10) {
    flagStatus = 'suspicious';
  }
  
  if (proctoring.offScreenTime > 300000) { // 5 minutes
    flagStatus = 'high_risk';
  }
  
  // Save to database
  await db.examResults.create({
    ...req.body,
    flagStatus,
    proctoringData: proctoring
  });
  
  res.json({ success: true, flagStatus });
});
```

---

## Configuration Recommendations

### By Exam Type

```typescript
// Quiz / Low-stakes
const quizConfig = {
  sensitivity: 'low' as const,
  enableWarnings: true,
  offScreenThreshold: 3000,
  maxWarnings: 5
};

// Standard Exam
const examConfig = {
  sensitivity: 'medium' as const,
  enableWarnings: true,
  offScreenThreshold: 2000,
  maxWarnings: 3
};

// Certification Exam
const certConfig = {
  sensitivity: 'high' as const,
  enableWarnings: true,
  offScreenThreshold: 1500,
  maxWarnings: 2
};

// High-Stakes / Proctored
const proctoredConfig = {
  sensitivity: 'strict' as const,
  enableWarnings: true,
  offScreenThreshold: 1000,
  maxWarnings: 1
};
```

---

## Migration from Old System

If migrating from `useEyeGazeDetection`:

```typescript
// OLD
const { gazeData, isDetecting, suspiciousEvents } = useEyeGazeDetection(examStarted);

// NEW
const gazeTracking = useGazeTracking({ enableWarnings: true });

// Mapping:
// gazeData.gazeDirection -> gazeTracking.currentZone
// isDetecting -> gazeTracking.isRunning
// suspiciousEvents -> gazeTracking.violations
// New: gazeTracking.metrics.attentionPercentage
// New: gazeTracking.warningLevel
// New: gazeTracking.latestWarning
```

---

## Testing the Integration

### Manual Testing Checklist

- [ ] Camera starts without errors
- [ ] Gaze zone updates in real-time
- [ ] Looking away triggers warning after threshold
- [ ] Warning banners appear at correct levels
- [ ] Metrics update continuously
- [ ] Stop button works properly
- [ ] No performance degradation
- [ ] Works in different lighting conditions

### Automated Testing

```typescript
describe('Exam with Gaze Tracking', () => {
  test('starts gaze tracking when exam begins', async () => {
    render(<Exam />);
    
    // Start exam
    fireEvent.click(screen.getByText('Start Exam'));
    
    // Verify tracking started
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  test('shows warning when looking away', async () => {
    // Mock gaze sample looking away
    mockGazeSample({ zone: 'left' });
    
    await waitFor(() => {
      expect(screen.getByText(/looking left/i)).toBeInTheDocument();
    });
  });
});
```

---

## Performance Tips

1. **Use frameSkip**: Don't process every frame
   ```typescript
   frameSkip: 3 // ~10fps is sufficient
   ```

2. **Lower video resolution**: 
   ```typescript
   // In GazeTrackingEngine.ts
   video: {
     width: { ideal: 640, max: 1280 },
     height: { ideal: 480, max: 720 }
   }
   ```

3. **Monitor in DevTools**:
   - Chrome DevTools > Performance
   - Check for frame drops
   - Adjust `frameSkip` if needed

4. **Lazy load models**:
   ```typescript
   // Only initialize when needed
   const [shouldLoad, setShouldLoad] = useState(false);
   
   useEffect(() => {
     if (examStarted) setShouldLoad(true);
   }, [examStarted]);
   
   const gazeTracking = useGazeTracking(shouldLoad ? config : undefined);
   ```

---

## Support

For issues or questions:
1. Check `docs/GAZE_TRACKING_MODULE.md` for full documentation
2. Review browser console for errors
3. Test with different configurations
4. Contact the engineering team

---

**Last Updated**: 2026-04-03
