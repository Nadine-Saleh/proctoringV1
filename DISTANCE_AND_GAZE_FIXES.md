# Distance & Gaze Tracking Fixes

## Issues Fixed

### 1. ❌ Negative Distance Display (-62cm)
**Problem**: Distance was showing negative values like `-62.1076cm` with a warning icon.

**Root Cause**: 
- `GazeTrackingEngine.estimateFaceDistance()` returned a normalized 0-1 value
- Formula was `1 - faceHeight` which produced incorrect results
- `Exam.tsx` multiplied this by 100, creating unrealistic values

**Solution**:
✅ **Fixed `GazeTrackingEngine.ts`** - Corrected distance calculation formula:
```typescript
// OLD (broken):
return Math.max(0, Math.min(1, 1 - faceHeight));

// NEW (fixed):
const distance = (faceHeight - 0.15) / (0.35 - 0.15);
return Math.max(0, Math.min(1, distance));
```

✅ **Fixed `Exam.tsx`** - Proper conversion from normalized 0-1 to realistic cm:
```typescript
// OLD: Multiplied by 100 (incorrect)
const faceDistanceCm = examStarted ? (gazeSample?.faceDistance ?? 0) * 100 : livenessFaceDistanceCm;

// NEW: Maps to realistic 30-100cm range
const gazeDistanceCm = gazeSample ? Math.round(30 + (1 - gazeSample.faceDistance) * 70) : null;
const faceDistanceCm = examStarted ? gazeDistanceCm : livenessFaceDistanceCm;
```

**Expected Result**: Distance now shows realistic values between 30-100cm based on actual face position.

---

### 2. ❌ Session Error: "invalid input syntax for type uuid: '2'"
**Problem**: Database rejected exam session creation with UUID syntax error.

**Root Cause**: 
- Mock exam data uses simple numeric IDs (1, 2, 3)
- Supabase `exam_sessions` table expects UUID format for `exam_id` and `student_id` columns
- Direct insertion of `"2"` failed UUID validation

**Solution**:
✅ **Created `src/utils/uuid.ts`** - UUID conversion utilities:
- `mockIdToUuid()` - Converts mock IDs to deterministic UUID v4 format
- `ensureUuid()` - Auto-detects and converts non-UUID IDs
- `isValidUuid()` - Validates UUID format

✅ **Updated `ExamSessionService.ts`**:
```typescript
// Convert mock IDs to UUIDs for database compatibility
const examUuid = ensureUuid(input.exam_id, 'exam');
const studentUuid = ensureUuid(input.student_id, 'student');

// Use UUIDs in database operations
.from('exam_sessions')
.insert({
  exam_id: examUuid,
  student_id: studentUuid,
  // ...
})
```

**How It Works**:
- Mock ID `"2"` → UUID `"00000002-0000-4000-8000-000000000002"` (deterministic)
- Real UUIDs pass through unchanged
- Consistent mapping across all database operations

**Expected Result**: Session creation succeeds with mock exam data.

---

### 3. ❌ Eye Gaze Not Detected
**Problem**: Gaze tracking appeared inactive despite green checkmark.

**Root Causes**:
1. Distance calculation errors affected gaze zone detection
2. Insufficient logging to diagnose initialization issues
3. Video element might not be properly connected

**Solutions**:
✅ **Added comprehensive logging**:
```typescript
// In GazeTrackingEngine.start():
console.log('[GazeEngine] Starting gaze tracking...');
console.log('[GazeEngine] Gaze tracking started successfully');

// In processFrame():
console.warn('[GazeEngine] Running but no video element set');
```

✅ **Improved validation**:
- Check if video element exists before starting
- Verify models are loaded
- Log warnings when prerequisites missing

✅ **Fixed distance calculation** (see Issue #1) - This also fixes gaze zone detection

**How to Verify Gaze is Working**:
1. Check browser console for `[GazeEngine]` logs
2. Look for:
   - ✅ `Models loaded`
   - ✅ `Starting gaze tracking...`
   - ✅ `Gaze tracking started successfully`
3. Verify video element is being passed:
   - In Exam.tsx, `gazeVideoRef(element)` should be called
4. Check for gaze samples in React DevTools (useGazeTracking hook state)

**Expected Result**: Gaze tracking now actively detects face position and gaze direction.

---

## Files Modified

### Core Fixes
1. **`src/lib/gaze/GazeTrackingEngine.ts`**
   - Fixed `estimateFaceDistance()` formula
   - Added initialization logging
   - Added video element validation

2. **`src/pages/student/Exam.tsx`**
   - Fixed distance conversion (0-1 → realistic cm)
   - Added `gazeDistanceCm` calculation

3. **`src/services/ExamSessionService.ts`**
   - Added UUID conversion for mock IDs
   - Updated `create()` method
   - Updated `getActiveSession()` method

### New Files
4. **`src/utils/uuid.ts`** ⭐ NEW
   - UUID generation and validation utilities
   - Mock ID to UUID conversion

---

## Testing Checklist

### Distance Display
- [ ] Start an exam
- [ ] Complete liveness check
- [ ] Verify distance shows realistic value (30-100cm)
- [ ] Move closer to camera → distance should decrease
- [ ] Move farther from camera → distance should increase
- [ ] No negative values displayed

### Session Creation
- [ ] Complete liveness verification
- [ ] Check browser console for session creation logs
- [ ] Verify no UUID errors
- [ ] Verify "Session Active" status appears
- [ ] Check Supabase `exam_sessions` table for new record

### Gaze Tracking
- [ ] Check console for `[GazeEngine]` logs
- [ ] Verify "Gaze tracking started successfully"
- [ ] Look at Eye Gaze status indicator (should be green)
- [ ] Move head left/right → gaze status should update
- [ ] Look away from screen → should detect "looking-away"
- [ ] Check browser console for gaze samples

---

## Debugging Tips

### If Distance Still Shows Incorrect Values:
```javascript
// Check in browser console:
console.log('[Exam] Gaze sample:', gazeSample);
console.log('[Exam] Face distance (normalized):', gazeSample?.faceDistance);
console.log('[Exam] Distance (cm):', gazeDistanceCm);
```

### If Session Still Fails:
```javascript
// Check UUID conversion:
import { ensureUuid } from './utils/uuid';
console.log(ensureUuid('2', 'exam')); // Should output valid UUID
```

### If Gaze Not Detecting:
```javascript
// Verify initialization sequence:
// 1. Models loaded: gazeModelsLoaded === true
// 2. Camera ready: status.camera === true
// 3. Exam started: examStarted === true
// 4. Gaze running: gazeRunning === true
```

---

## Expected Console Output (Success)

```
[GazeEngine] Starting gaze tracking...
[GazeEngine] Gaze tracking started successfully
[ExamSessionService] Creating session for exam: 2 (UUID: 00000002-...) student: user123 (UUID: ...)
[ExamSessionService] Session created successfully: abc-123-...
[Exam] Session started
```

---

## Future Improvements

- [ ] Add real-time gaze visualization overlay
- [ ] Store actual UUIDs in mock data for realism
- [ ] Add distance calibration UI
- [ ] Implement face distance thresholds with visual feedback
- [ ] Add gaze tracking heatmap for post-exam review
