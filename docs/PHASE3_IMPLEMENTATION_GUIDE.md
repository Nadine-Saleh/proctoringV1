# Phase 3 Implementation Guide - Backend Integration & Persistence

## Overview
This document provides step-by-step instructions to complete Phase 3 of the cheating score system implementation.

---

## ✅ Phase 3.1: Database Schema (READY TO DEPLOY)

### What's Already Done
The database schema is already in place in `001_initial_schema.sql`:
- ✅ `violation_events` table
- ✅ `cheating_scores` table
- ✅ `instructor_alerts` table
- ✅ All necessary indexes

### What's New
Created `004_cheating_score_functions.sql` with these database functions:
1. **`calculate_cheating_score(session_id, window_minutes)`** - Calculates and persists cheating scores
2. **`record_violation_and_update_score(...)`** - Records violation and auto-updates score
3. **`get_high_risk_sessions(exam_id, minutes_ago)`** - Returns high-risk student sessions
4. **`acknowledge_instructor_alert(alert_id, instructor_id)`** - Marks alert as reviewed
5. **`create_instructor_alert(...)`** - Creates instructor alert record

### Deployment Steps

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run Migration 004**
   - Open `supabase/migrations/004_cheating_score_functions.sql`
   - Copy entire file contents
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Functions Created**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%cheating%' OR routine_name LIKE '%alert%';
   ```
   
   Expected results:
   - `calculate_cheating_score`
   - `record_violation_and_update_score`
   - `get_high_risk_sessions`
   - `acknowledge_instructor_alert`
   - `create_instructor_alert`

---

## ✅ Phase 3.2: Services Created (READY)

### New Services Created

1. **`CheatingScoreService.ts`**
   - Location: `src/services/CheatingScoreService.ts`
   - Methods:
     - `calculateAndPersist(sessionId)` - Calls DB function to calculate score
     - `getBySession(sessionId)` - Fetch score for a session
     - `getByExam(examId)` - All scores for an exam
     - `getHighRiskSessions(examId, minutesAgo)` - High-risk students
     - `calculateClientSide(violations)` - Client-side score calculation

2. **`InstructorAlertDatabaseService.ts`**
   - Location: `src/services/InstructorAlertDatabaseService.ts`
   - Methods:
     - `create(input)` - Create alert in database
     - `getUnacknowledgedByExam(examId)` - Get pending alerts
     - `getAllByExam(examId)` - All alerts (including acknowledged)
     - `acknowledge(alertId, instructorId)` - Mark alert reviewed
     - `countByExam(examId)` - Alert statistics

3. **`WebSocketService.ts`**
   - Location: `src/services/WebSocketService.ts`
   - Features:
     - Automatic reconnection with exponential backoff
     - Heartbeat/ping-pong for connection health
     - Message queuing when disconnected
     - Event-driven message handlers
   - Singleton pattern via `getInstructorWebSocketService()`

4. **Updated `instructorAlertService.ts`**
   - Now integrates with database (persists alerts)
   - Uses new WebSocketService for real-time delivery
   - Maintains backward compatibility with legacy `window.instructorSocket`

### Existing Services Updated

- **`ViolationEventService.ts`** - Already has CRUD operations ✅
- **`ExamSessionService.ts`** - Already fetches cheating_scores ✅
- **`useViolationTracker.ts`** - Already batches and persists violations ✅

---

## 🔧 Phase 3.3: WebSocket Server Setup (TODO)

### Option A: Simple Node.js WebSocket Server

Create a simple WebSocket server for development:

```javascript
// server/ws-server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 4000 });

console.log('WebSocket server running on ws://localhost:4000');

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const instructorId = url.pathname.split('/').pop();

  console.log(`Instructor connected: ${instructorId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[WS] Message from ${instructorId}:`, data.type);

      // Handle ping
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', payload: { timestamp: Date.now() } }));
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`Instructor disconnected: ${instructorId}`);
  });
});

// Function to broadcast alert to instructor
function broadcastAlertToInstructor(instructorId, alert) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'critical_alert',
        payload: alert
      }));
    }
  });
}

module.exports = { wss, broadcastAlertToInstructor };
```

Run the server:
```bash
node server/ws-server.js
```

### Option B: Supabase Realtime (Recommended for Production)

Use Supabase's built-in Realtime feature:

1. **Enable Realtime for Tables**
   - Go to Supabase Dashboard → Database → Replication
   - Enable Realtime for:
     - `instructor_alerts`
     - `violation_events`
     - `cheating_scores`

2. **Subscribe to Changes in Instructor Dashboard**
   ```typescript
   import { supabase } from '../lib/supabase/client';

   // In Proctoring.tsx
   useEffect(() => {
     const channel = supabase
       .channel('alerts')
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'instructor_alerts',
           filter: `exam_id=eq.${examId}`,
         },
         (payload) => {
           console.log('New alert received:', payload.new);
           // Show alert in UI
         }
       )
       .subscribe();

     return () => {
       supabase.removeChannel(channel);
     };
   }, [examId]);
   ```

### Environment Variables

Create `.env` file (if not exists):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WS_URL=ws://localhost:4000/instructor
```

---

## 🔧 Phase 3.4: Service Integration (TODO)

### 1. Update Proctoring.tsx to Load Alerts from Database

In `src/pages/instructor/Proctoring.tsx`:

```typescript
import { InstructorAlertDatabaseService } from '../../services/InstructorAlertDatabaseService';
import { getInstructorWebSocketService } from '../../services/WebSocketService';

// In the component:
const [liveAlerts, setLiveAlerts] = useState<AlertWithStudentInfo[]>([]);

// Load alerts on mount and exam selection
useEffect(() => {
  if (!examId) return;

  // Load existing unacknowledged alerts
  const loadAlerts = async () => {
    const result = await InstructorAlertDatabaseService.getUnacknowledgedByExam(examId);
    if (result.success && result.alerts) {
      setLiveAlerts(result.alerts);
    }
  };

  loadAlerts();
}, [examId]);

// Initialize WebSocket connection
useEffect(() => {
  const wsService = getInstructorWebSocketService();
  
  wsService.on('critical_alert', (payload) => {
    console.log('Real-time alert received:', payload);
    setLiveAlerts(prev => [payload, ...prev]);
    
    // Show notification
    showBrowserNotification(payload);
    playAlertSound();
  });

  wsService.connect();

  return () => {
    wsService.disconnect();
  };
}, []);

// Acknowledge alert function
const acknowledgeAlert = async (alertId: string) => {
  if (!user) return;
  
  const result = await InstructorAlertDatabaseService.acknowledge(alertId, user.id);
  if (result.success) {
    setLiveAlerts(prev => prev.filter(a => a.id !== alertId));
  }
};
```

### 2. Update Exam.tsx to Calculate Scores Periodically

In `src/pages/student/Exam.tsx`:

```typescript
import { CheatingScoreService } from '../../services/CheatingScoreService';

// After recording violations, calculate score periodically
useEffect(() => {
  if (!session?.id || !examStarted) return;

  // Calculate score every 30 seconds
  const interval = setInterval(async () => {
    const result = await CheatingScoreService.calculateAndPersist(session.id);
    
    if (result.success && result.score) {
      console.log('[Exam] Cheating score calculated:', result.score.overall_score);
      
      // Update local state for display
      setViolationScore(result.score.overall_score);
      setRiskLevel(result.score.risk_level as any);
    }
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, [session?.id, examStarted]);
```

### 3. Update Exam Submission to Include Final Score

In `src/services/ExamSubmissionService.ts`:

```typescript
import { CheatingScoreService } from './CheatingScoreService';

// Before submitting exam, calculate final score
const finalScore = await CheatingScoreService.calculateAndPersist(sessionId, 300000); // 5 min window

// Include in submission
const submission = {
  // ... existing fields
  cheating_score: finalScore.score?.overall_score || 0,
  risk_level: finalScore.score?.risk_level || 'low',
  total_violations: finalScore.score?.total_violations || 0,
};
```

### 4. Update Results Page to Show Cheating Score

In `src/pages/instructor/Results.tsx` or `src/pages/student/Results.tsx`:

```typescript
import { CheatingScoreService } from '../../services/CheatingScoreService';

// Fetch score for each session
useEffect(() => {
  if (!sessions.length) return;

  const loadScores = async () => {
    const scores = await Promise.all(
      sessions.map(async (session) => {
        const result = await CheatingScoreService.getBySession(session.session_id);
        return {
          sessionId: session.session_id,
          score: result.score?.overall_score || 0,
          riskLevel: result.score?.risk_level || 'low',
        };
      })
    );
    
    setSessionScores(scores);
  };

  loadScores();
}, [sessions]);
```

---

## 🧪 Testing Phase 3

### Test 1: Violation Recording → Database

1. Start exam as student
2. Trigger violations (look away, multiple faces, etc.)
3. Check browser console for `[useViolationTracker] Synced X violations`
4. Check Supabase → Table Editor → `violation_events`
5. Verify violations appear in table

### Test 2: Score Calculation

1. After violations are recorded, wait 30 seconds
2. Check Supabase → Table Editor → `cheating_scores`
3. Verify score is calculated and matches expected value
4. Run SQL function manually:
   ```sql
   SELECT * FROM calculate_cheating_score('your-session-id');
   ```

### Test 3: Instructor Alerts

1. Trigger high-risk violations (score ≥ 50)
2. Check Supabase → Table Editor → `instructor_alerts`
3. Verify alert record exists
4. Open instructor dashboard
5. Verify alert appears in Live Alerts panel

### Test 4: Alert Acknowledgment

1. Click "Acknowledge" button on alert
2. Verify alert disappears from Live Alerts panel
3. Check database: `is_acknowledged` should be `true`

### Test 5: WebSocket Real-Time (if server is running)

1. Open instructor dashboard in Browser A
2. Start exam in Browser B
3. Trigger violations in Browser B
4. Verify alert appears in Browser A without refresh

---

## 📋 Phase 3 Completion Checklist

- [ ] **004_cheating_score_functions.sql** deployed to Supabase
- [ ] **Database functions** verified in SQL Editor
- [ ] **ViolationEventService** successfully recording to database
- [ ] **CheatingScoreService** calculating and persist scores
- [ ] **InstructorAlertDatabaseService** creating and acknowledging alerts
- [ ] **WebSocketService** connected (or Supabase Realtime enabled)
- [ ] **Exam.tsx** sending sessionId with alerts
- [ ] **Proctoring.tsx** loading alerts from database
- [ ] **End-to-end test** passed (violations → score → alert → acknowledgment)

---

## 🐛 Common Issues & Solutions

### Issue 1: "Function not found" error
**Solution**: Ensure migration 004 was run successfully in SQL Editor.

### Issue 2: Violations not syncing
**Solution**: 
- Check console for `[useViolationTracker]` logs
- Verify `session?.id` is not null
- Check network tab for Supabase requests
- Verify RLS policies allow inserts

### Issue 3: Alerts not appearing in instructor dashboard
**Solution**:
- Check if examId is set correctly
- Verify `InstructorAlertDatabaseService.getUnacknowledgedByExam` returns data
- Check WebSocket connection status
- Look for console errors

### Issue 4: WebSocket not connecting
**Solution**:
- Verify `VITE_WS_URL` in `.env` is correct
- Ensure WebSocket server is running
- Check browser console for connection errors
- Try connecting manually: `new WebSocket('ws://localhost:4000')`

### Issue 5: RLS policy blocking operations
**Solution**: Create permissive policies for testing:
```sql
-- Allow all authenticated users to insert violations
CREATE POLICY "Allow violation inserts"
ON violation_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to read alerts
CREATE POLICY "Allow alert reads"
ON instructor_alerts FOR SELECT
TO authenticated
USING (true);
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    STUDENT EXAM                         │
│                                                         │
│  useViolationTracker                                    │
│       ↓                                                 │
│  ViolationEventService.createBatch()                    │
│       ↓                                                 │
│  ┌──────────────────────┐                               │
│  │  violation_events    │ ← Database Table              │
│  └──────────────────────┘                               │
│       ↓                                                 │
│  CheatingScoreService.calculateAndPersist()             │
│       ↓                                                 │
│  ┌──────────────────────┐                               │
│  │  cheating_scores     │ ← Database Table              │
│  └──────────────────────┘                               │
│       ↓                                                 │
│  sendCriticalAlert()                                    │
│       ↓                                                 │
│  InstructorAlertDatabaseService.create()                │
│       ↓                                                 │
│  ┌──────────────────────┐                               │
│  │  instructor_alerts   │ ← Database Table              │
│  └──────────────────────┘                               │
│       ↓                                                 │
│  WebSocketService.send() ────┐                          │
└──────────────────────────────┼──────────────────────────┘
                               │
                               │ Real-Time
                               ↓
┌─────────────────────────────────────────────────────────┐
│                  INSTRUCTOR DASHBOARD                    │
│                                                         │
│  WebSocketService.on('critical_alert')                  │
│       ↓                                                 │
│  InstructorAlertDatabaseService.getUnacknowledged()     │
│       ↓                                                 │
│  Live Alerts Panel (UI)                                 │
│       ↓                                                 │
│  Acknowledge Button → Database Update                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps After Phase 3

1. **Phase 4**: AI-powered violation pattern analysis
2. **Phase 4**: Screenshot capture on critical violations
3. **Phase 4**: Video recording with timestamped violations
4. **Phase 5**: Performance optimization and scaling
5. **Phase 5**: Production deployment and monitoring

---

**Last Updated**: April 14, 2026
**Status**: Phase 3 implementation guide ready for deployment
