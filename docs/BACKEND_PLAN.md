# Backend Plan: Exam Session Management & Incident Reporting

## Overview

This document outlines the backend architecture for managing exam sessions, calculating cheating scores, and reporting incidents to instructors in real-time.

---

## Table of Contents

1. [Technology Comparison: Firebase vs Alternatives](#1-technology-comparison)
2. [Recommended Architecture](#2-recommended-architecture)
3. [Database Schema](#3-database-schema)
4. [Cheating Score Calculation Engine](#4-cheating-score-calculation-engine)
5. [Real-Time Incident Reporting](#5-real-time-incident-reporting)
6. [API Endpoints](#6-api-endpoints)
7. [Security & Anti-Cheating Measures](#7-security--anti-cheating-measures)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Technology Comparison

### Firebase vs Supabase vs Custom Backend

| Feature | **Firebase** | **Supabase** | **Custom (Node.js + PostgreSQL)** |
|---|---|---|---|
| **Real-time Updates** | ✅ Excellent (Firestore listeners) | ✅ Good (Realtime subscriptions) | ⚠️ Requires WebSocket setup |
| **Authentication** | ✅ Excellent (multi-provider) | ✅ Good (email + OAuth) | ⚠️ Manual implementation |
| **Database** | NoSQL (Firestore) - flexible but limited querying | PostgreSQL - powerful relational queries | PostgreSQL - full control |
| **Cloud Functions** | ✅ Firebase Functions (Node.js) | ✅ Edge Functions (Deno/Node.js) | ✅ Full control |
| **Scalability** | ✅ Auto-scales | ✅ Auto-scales | ⚠️ Manual scaling |
| **Complex Queries** | ⚠️ Limited (no joins, limited filtering) | ✅ Excellent (SQL joins, indexes) | ✅ Excellent |
| **Data Integrity** | ⚠️ Eventually consistent | ✅ ACID transactions | ✅ ACID transactions |
| **Cost (small/med)** | $$ (pay per read/write) | $ (generous free tier) | $$ (server hosting) |
| **Vendor Lock-in** | 🔴 High | 🟡 Medium | 🟢 Low |
| **Learning Curve** | Low | Low | Medium |

### Recommendation: **Supabase** (Already in Dependencies!)

**Why Supabase?**

1. **Already Installed**: `@supabase/supabase-js 2.57.4` is in `package.json` but unused
2. **Relational Data**: Violation events, sessions, and exams benefit from SQL relationships
3. **Complex Queries**: Need to aggregate violations across time windows, join with student data
4. **Real-time**: Built-in WebSocket subscriptions for live instructor alerts
5. **Row-Level Security**: Fine-grained access control (students only see their data)
6. **Cost-Effective**: Generous free tier, predictable pricing
7. **Edge Functions**: Serverless functions for cheating score calculation

**When Firebase Would Be Better:**
- If you need offline-first capabilities (not relevant for proctoring)
- If you're building a mobile app with heavy sync needs
- If your team already knows Firebase well

**Conclusion**: **Supabase is the better choice** for this use case.

---

## 2. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Exam.tsx │  │ Proctoring   │  │ Gaze Detection Hooks  │  │
│  │          │  │ Hooks        │  │                       │  │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘  │
│       │                │                       │              │
│       └────────────────┴───────────────────────┘              │
│                          │                                    │
│                   Event Batcher                               │
│              (buffer + send every 5s)                         │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
                    HTTPS / WSS
                           │
┌──────────────────────────┼────────────────────────────────────┐
│                    SUPABASE PLATFORM                          │
│                           │                                    │
│  ┌────────────────────────┴────────────────────────────────┐  │
│  │                   DATABASE (PostgreSQL)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │  │
│  │  │ Users    │ │ Exams    │ │ Sessions  │ │Violation │  │  │
│  │  │          │ │          │ │           │ │ Events   │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │  │
│  │  │ Cheating │ │ Alerts   │ │ Answers   │ │ Reports  │  │  │
│  │  │ Scores   │ │          │ │           │ │          │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────┴────────────────────────────────┐  │
│  │                  EDGE FUNCTIONS                         │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Calculate Cheating  │  │ Send Instructor Alert    │  │  │
│  │  │ Score (trigger)     │  │ (real-time)              │  │  │
│  │  └─────────────────────┘  └──────────────────────────┘  │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Generate Report     │  │ Auto-flag Suspicious     │  │  │
│  │  │ (PDF export)        │  │ Sessions                 │  │  │
│  │  └─────────────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────┴────────────────────────────────┐  │
│  │                  REALTIME CHANNELS                      │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Live Violation      │  │ Instructor Alert Feed    │  │  │
│  │  │ Stream              │  │ (WebSocket)              │  │  │
│  │  └─────────────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Client-Side Detection**:
   - Gaze tracking, face detection, tab visibility run in browser
   - Events batched locally (every 5 seconds or immediately for critical events)
   - Batch sent to Supabase via REST API

2. **Server-Side Processing**:
   - Edge Function receives violation events
   - Calculates rolling cheating score using weighted algorithm
   - If score exceeds threshold, triggers real-time alert to instructor
   - Stores everything in database for later review

3. **Real-Time Notifications**:
   - Instructor dashboard subscribes to Supabase Realtime channel
   - Receives instant notifications for critical violations
   - Can view live proctoring monitor with all active students

---

## 3. Database Schema

```sql
-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('student', 'instructor', 'admin')) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXAMS
-- ============================================
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(100),
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  passing_score DECIMAL(5,2),
  settings JSONB DEFAULT '{}',  -- { allowCalculator, shuffleQuestions, showResults }
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- ============================================
-- QUESTIONS
-- ============================================
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'essay')),
  options JSONB,  -- [{ id: 'a', text: '...' }, ...]
  correct_answer VARCHAR(10),
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- EXAM SESSIONS (Exam Attempts)
-- ============================================
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'flagged', 'invalidated')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  duration_taken_seconds INTEGER,
  liveness_check_passed BOOLEAN DEFAULT FALSE,
  liveness_check_data JSONB,  -- Store verification metadata
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIOLATION EVENTS (Raw Proctoring Data)
-- ============================================
CREATE TABLE violation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Violation Details
  violation_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  weight DECIMAL(5,2) DEFAULT 0,  -- Pre-calculated weight for scoring
  
  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER,  -- How long the violation lasted
  
  -- Context
  description TEXT,
  metadata JSONB DEFAULT '{}',  -- { direction: 'left', face_count: 2, gaze_zone: 'off-screen' }
  
  -- Processing
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_violation_sessions ON violation_events(session_id);
CREATE INDEX idx_violation_students ON violation_events(student_id, occurred_at);
CREATE INDEX idx_violation_exams ON violation_events(exam_id, occurred_at);

-- ============================================
-- CHEATING SCORES (Calculated Periodically)
-- ============================================
CREATE TABLE cheating_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scores (0-100)
  overall_score DECIMAL(5,2) NOT NULL,
  gaze_score DECIMAL(5,2) DEFAULT 0,
  face_detection_score DECIMAL(5,2) DEFAULT 0,
  tab_switch_score DECIMAL(5,2) DEFAULT 0,
  behavioral_score DECIMAL(5,2) DEFAULT 0,
  
  -- Metrics
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  total_violations INTEGER DEFAULT 0,
  critical_violations INTEGER DEFAULT 0,
  attention_score DECIMAL(5,2),  -- % time looking at screen
  avg_violation_interval_sec INTEGER,  -- Average time between violations
  
  -- Time Windows (for rolling calculation)
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  last_violation_at TIMESTAMPTZ,
  calculation_window_minutes INTEGER DEFAULT 5,  -- Rolling window size
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active score per session (enforced by unique constraint)
CREATE UNIQUE INDEX idx_cheating_session ON cheating_scores(session_id);

-- ============================================
-- STUDENT ANSWERS
-- ============================================
CREATE TABLE student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer VARCHAR(10),
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  answer_order INTEGER,  -- Track order of answering
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALERTS (Instructor Notifications)
-- ============================================
CREATE TABLE instructor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Alert Details
  alert_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  cheating_score_at_time DECIMAL(5,2),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  violation_summary JSONB,  -- { gaze_away_count: 5, tab_switches: 2, ... }
  
  -- Status
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for real-time queries
CREATE INDEX idx_alerts_exam_active ON instructor_alerts(exam_id, created_at DESC);
CREATE INDEX idx_alerts_student ON instructor_alerts(student_id, created_at DESC);

-- ============================================
-- PROCTORING REPORTS (Final Summary)
-- ============================================
CREATE TABLE proctoring_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Summary
  final_cheating_score DECIMAL(5,2) NOT NULL,
  final_risk_level VARCHAR(20) NOT NULL,
  total_violations INTEGER NOT NULL,
  violation_breakdown JSONB,  -- { gaze_looking_away: 12, tab_switch: 3, ... }
  
  -- Exam Performance
  exam_score DECIMAL(5,2),
  exam_percentage DECIMAL(5,2),
  time_taken_minutes DECIMAL(5,2),
  
  -- Recommendation
  instructor_recommendation VARCHAR(50),  -- { approve, review, invalidate }
  instructor_notes TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_report_session ON proctoring_reports(session_id);
```

---

## 4. Cheating Score Calculation Engine

### Algorithm Overview

The cheating score is a **weighted, time-decayed aggregate** of all violation events during an exam session.

```typescript
interface CheatingScoreComponents {
  // Category Scores (0-100 each)
  gazeScore: number;           // Looking away, eye closure, blinking
  faceDetectionScore: number;  // Face not detected, multiple faces
  tabSwitchScore: number;      // Browser tab changes
  behavioralScore: number;     // Rapid eye movement, unusual patterns
  
  // Weights for categories
  categoryWeights: {
    gaze: 0.35,                // 35% weight
    faceDetection: 0.30,       // 30% weight
    tabSwitch: 0.25,           // 25% weight
    behavioral: 0.10           // 10% weight
  };
  
  // Time decay factor (recent violations matter more)
  timeDecayFactor: number;     // e.g., 0.8 for 20% decay per minute
  
  // Rolling window
  windowMinutes: number;       // Calculate based on last 5 minutes
}
```

### Calculation Formula

```typescript
/**
 * Calculate cheating score for a session
 * 
 * Formula:
 * overall_score = Σ(category_score × category_weight) × time_decay × severity_multiplier
 */

function calculateCheatingScore(
  violations: ViolationEvent[],
  sessionDuration: number,
  currentTime: Date
): CheatingScoreResult {
  
  const now = currentTime || new Date();
  const windowMs = 5 * 60 * 1000; // 5-minute rolling window
  
  // Filter violations within the window
  const recentViolations = violations.filter(v => 
    (now.getTime() - new Date(v.occurred_at).getTime()) <= windowMs
  );
  
  // Calculate category scores
  const gazeViolations = recentViolations.filter(v => 
    v.type.startsWith('gaze_') || v.type.startsWith('eye_')
  );
  const faceViolations = recentViolations.filter(v => 
    v.type.startsWith('face_') || v.type.startsWith('multiple_')
  );
  const tabViolations = recentViolations.filter(v => 
    v.type.startsWith('tab_')
  );
  const behavioralViolations = recentViolations.filter(v => 
    v.type.startsWith('rapid_') || v.type.startsWith('excessive_')
  );
  
  // Score calculation per category (0-100)
  const gazeScore = calculateCategoryScore(gazeViolations, windowMs);
  const faceDetectionScore = calculateCategoryScore(faceViolations, windowMs);
  const tabSwitchScore = calculateCategoryScore(tabViolations, windowMs);
  const behavioralScore = calculateCategoryScore(behavioralViolations, windowMs);
  
  // Weighted average
  const weightedScore = 
    (gazeScore * 0.35) +
    (faceDetectionScore * 0.30) +
    (tabSwitchScore * 0.25) +
    (behavioralScore * 0.10);
  
  // Time decay (recent violations weigh more)
  const timeDecayedScore = applyTimeDecay(weightedScore, recentViolations, now);
  
  // Cap at 100
  const finalScore = Math.min(timeDecayedScore, 100);
  
  // Determine risk level
  const riskLevel = getRiskLevel(finalScore);
  
  return {
    overallScore: finalScore,
    gazeScore,
    faceDetectionScore,
    tabSwitchScore,
    behavioralScore,
    riskLevel,
    totalViolations: recentViolations.length,
    criticalViolations: recentViolations.filter(v => v.severity === 'critical').length,
    calculatedAt: now
  };
}

/**
 * Calculate score for a single category
 * Uses violation weights, frequency, and duration
 */
function calculateCategoryScore(
  violations: ViolationEvent[],
  windowMs: number
): number {
  if (violations.length === 0) return 0;
  
  // Base score from violation weights
  const totalWeight = violations.reduce((sum, v) => sum + v.weight, 0);
  
  // Frequency factor (more violations = higher score)
  const frequencyFactor = violations.length / (windowMs / 60000); // per minute
  
  // Duration factor (longer violations = higher score)
  const avgDuration = violations.reduce((sum, v) => sum + (v.duration_ms || 0), 0) / violations.length;
  const durationFactor = Math.min(avgDuration / 5000, 2); // Normalize to 2x max
  
  // Calculate raw score (0-100)
  const rawScore = (totalWeight * 10) + (frequencyFactor * 5) + (durationFactor * 10);
  
  // Cap at 100
  return Math.min(rawScore, 100);
}

/**
 * Apply time decay - recent violations matter more
 */
function applyTimeDecay(
  baseScore: number,
  violations: ViolationEvent[],
  now: Date
): number {
  if (violations.length === 0) return baseScore;
  
  const decayRate = 0.15; // 15% decay per minute
  
  // Calculate weighted average with decay
  let decayedSum = 0;
  let weightSum = 0;
  
  violations.forEach(v => {
    const minutesAgo = (now.getTime() - new Date(v.occurred_at).getTime()) / 60000;
    const decay = Math.exp(-decayRate * minutesAgo);
    decayedSum += v.weight * decay;
    weightSum += decay;
  });
  
  const decayedScore = (decayedSum / weightSum) * 10;
  
  // Blend base score with decayed score
  return (baseScore * 0.6) + (decayedScore * 0.4);
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}
```

### Violation Type Weights

```typescript
const VIOLATION_WEIGHTS: Record<string, number> = {
  // Gaze violations (weight: 1-5)
  'gaze_looking_away': 2,           // Brief look away (1-3s)
  'gaze_sustained_away': 5,         // Sustained look away (>3s)
  'gaze_prolonged_away': 8,         // Very long look away (>10s)
  
  // Eye behavior (weight: 1-6)
  'eye_closure': 6,                 // Eyes closed >400ms
  'excessive_blinking': 3,          // Abnormal blink rate
  'rapid_eye_movement': 4,          // Suspicious eye darting
  
  // Face detection (weight: 5-10)
  'face_not_detected': 5,           // Face left frame
  'multiple_faces': 10,             // Multiple people (HIGH)
  'face_too_close': 3,              // Leaning in
  'face_too_far': 3,                // Moving away
  
  // Tab/Window (weight: 3-7)
  'tab_switch': 3,                  // Brief tab change
  'tab_switch_prolonged': 7,        // Extended tab change (>5s)
  'window_minimize': 5,             // Minimized exam window
  
  // Head pose (weight: 3-6)
  'head_pose_extreme': 6,           // Looking far left/right/up/down
  'head_pose_moderate': 3,          // Slight head turn
  
  // Device/Environment (weight: 8-10)
  'phone_detected': 10,             // Phone in frame (VERY HIGH)
  'headphones_detected': 8,         // Wearing headphones
  
  // Pattern-based (calculated, not direct)
  'answer_pattern_suspicious': 7,   // Too fast/consistent answers
  'ip_address_change': 8            // Network changed mid-exam
};
```

### Edge Function: Auto-Calculate Scores

```typescript
// File: supabase/functions/calculate-score/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { session_id } = await req.json();
  
  // Fetch all violations for this session
  const { data: violations } = await supabase
    .from('violation_events')
    .select('*')
    .eq('session_id', session_id)
    .order('occurred_at', { ascending: true });
  
  // Fetch session details
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('*, exams(duration_minutes)')
    .eq('id', session_id)
    .single();
  
  // Calculate score
  const scoreResult = calculateCheatingScore(
    violations,
    session.duration_taken_seconds || 0,
    new Date()
  );
  
  // Upsert cheating_scores table
  const { error } = await supabase
    .from('cheating_scores')
    .upsert({
      session_id,
      exam_id: session.exam_id,
      student_id: session.student_id,
      ...scoreResult
    }, { onConflict: 'session_id' });
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  // If critical, send alert to instructor
  if (scoreResult.riskLevel === 'critical') {
    await sendInstructorAlert({
      exam_id: session.exam_id,
      session_id,
      student_id: session.student_id,
      cheating_score: scoreResult.overallScore,
      violations: scoreResult.totalViolations
    });
    
    // Optionally auto-flag the session
    await supabase
      .from('exam_sessions')
      .update({ status: 'flagged' })
      .eq('id', session_id);
  }
  
  return new Response(JSON.stringify({ success: true, score: scoreResult }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 5. Real-Time Incident Reporting

### Alert System Architecture

```typescript
// File: src/services/incidentReporter.ts

export class IncidentReporter {
  private supabase: SupabaseClient;
  private alertDebounce: Map<string, number>; // sessionId -> timestamp
  
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.alertDebounce = new Map();
  }
  
  /**
   * Submit violation events in batches (every 5 seconds)
   */
  async submitViolationBatch(events: ViolationEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    const { error } = await this.supabase
      .from('violation_events')
      .insert(events.map(e => ({
        session_id: e.sessionId,
        exam_id: e.examId,
        student_id: e.studentId,
        violation_type: e.type,
        severity: e.severity,
        weight: VIOLATION_WEIGHTS[e.type] || 1,
        occurred_at: e.timestamp,
        duration_ms: e.duration,
        description: e.description,
        metadata: e.metadata || {}
      })));
    
    if (error) {
      console.error('[IncidentReporter] Failed to submit violations:', error);
      // Queue for retry
      this.queueForRetry(events);
    }
    
    // Trigger score recalculation
    if (events.length > 0) {
      this.triggerScoreCalculation(events[0].sessionId);
    }
  }
  
  /**
   * Immediately submit critical violation (no batching)
   */
  async submitCriticalViolation(event: ViolationEvent): Promise<void> {
    const { error } = await this.supabase
      .from('violation_events')
      .insert({
        session_id: event.sessionId,
        exam_id: event.examId,
        student_id: event.studentId,
        violation_type: event.type,
        severity: 'critical',
        weight: VIOLATION_WEIGHTS[event.type] || 10,
        occurred_at: event.timestamp,
        duration_ms: event.duration,
        description: event.description,
        metadata: event.metadata || {}
      });
    
    if (!error) {
      // Immediately alert instructor
      await this.sendCriticalAlert({
        sessionId: event.sessionId,
        examId: event.examId,
        studentId: event.studentId,
        violationType: event.type,
        description: event.description
      });
    }
  }
  
  /**
   * Send real-time alert to instructor
   */
  private async sendCriticalAlert(details: CriticalAlertDetails): Promise<void> {
    // Check debounce (max 1 alert per student per 60 seconds)
    const lastAlert = this.alertDebounce.get(details.sessionId) || 0;
    const now = Date.now();
    
    if (now - lastAlert < 60000) {
      return; // Debounced
    }
    
    this.alertDebounce.set(details.sessionId, now);
    
    const { error } = await this.supabase
      .from('instructor_alerts')
      .insert({
        exam_id: details.examId,
        session_id: details.sessionId,
        student_id: details.studentId,
        alert_type: 'critical_violation',
        priority: 'critical',
        title: `Critical Violation Detected`,
        message: details.description,
        violation_summary: {
          type: details.violationType,
          timestamp: new Date().toISOString()
        }
      });
    
    if (error) {
      console.error('[IncidentReporter] Failed to send alert:', error);
    }
    
    // Also send via Realtime channel for instant notification
    await this.supabase.channel(`exam:${details.examId}`)
      .send({
        type: 'broadcast',
        event: 'critical_alert',
        payload: details
      });
  }
  
  /**
   * Subscribe to alerts (for instructor dashboard)
   */
  subscribeToAlerts(examId: string, callback: (alert: InstructorAlert) => void) {
    const channel = this.supabase
      .channel(`alerts:${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'instructor_alerts',
          filter: `exam_id=eq.${examId}`
        },
        (payload) => {
          callback(payload.new as InstructorAlert);
        }
      )
      .subscribe();
    
    return () => {
      this.supabase.removeChannel(channel);
    };
  }
  
  /**
   * Trigger server-side score calculation
   */
  private async triggerScoreCalculation(sessionId: string): Promise<void> {
    await this.supabase.functions.invoke('calculate-score', {
      body: { session_id: sessionId }
    });
  }
  
  /**
   * Queue failed events for retry
   */
  private queueForRetry(events: ViolationEvent[]): void {
    // Store in IndexedDB or localStorage
    const queue = JSON.parse(localStorage.getItem('violation_queue') || '[]');
    queue.push({ events, timestamp: Date.now(), attempts: 0 });
    localStorage.setItem('violation_queue', JSON.stringify(queue));
    
    // Retry after 10 seconds
    setTimeout(() => this.retryQueue(), 10000);
  }
  
  /**
   * Retry failed submissions
   */
  private async retryQueue(): Promise<void> {
    const queue = JSON.parse(localStorage.getItem('violation_queue') || '[]');
    
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      
      if (item.attempts >= 3) {
        // Give up after 3 attempts
        queue.splice(i, 1);
        continue;
      }
      
      try {
        await this.submitViolationBatch(item.events);
        queue.splice(i, 1); // Remove on success
      } catch (error) {
        item.attempts++;
      }
    }
    
    localStorage.setItem('violation_queue', JSON.stringify(queue));
  }
}
```

### Instructor Real-Time Dashboard

```typescript
// File: src/pages/instructor/LiveProctoring.tsx

export function LiveProctoring({ examId }: Props) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [activeAlerts, setActiveAlerts] = useState<InstructorAlert[]>([]);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  
  useEffect(() => {
    // Subscribe to real-time alerts
    const unsubscribe = supabase
      .channel(`alerts:${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'instructor_alerts',
          filter: `exam_id=eq.${examId}`
        },
        (payload) => {
          const alert = payload.new as InstructorAlert;
          setActiveAlerts(prev => [alert, ...prev]);
          
          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification('Critical Proctoring Alert', {
              body: `${alert.student_name}: ${alert.message}`,
              icon: '/alert-icon.png'
            });
          }
        }
      )
      .subscribe();
    
    // Subscribe to cheating score updates
    const scoreChannel = supabase
      .channel(`scores:${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cheating_scores',
          filter: `exam_id=eq.${examId}`
        },
        (payload) => {
          setStudentScores(prev => {
            const updated = prev.filter(s => s.session_id !== payload.new.session_id);
            return [...updated, payload.new];
          });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(unsubscribe);
      supabase.removeChannel(scoreChannel);
    };
  }, [examId]);
  
  // Fetch current scores
  useEffect(() => {
    const fetchScores = async () => {
      const { data } = await supabase
        .from('cheating_scores')
        .select(`
          *,
          users(full_name, email),
          exam_sessions(started_at, status)
        `)
        .eq('exam_id', examId)
        .order('overall_score', { ascending: false });
      
      setStudentScores(data || []);
    };
    
    fetchScores();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchScores, 10000);
    return () => clearInterval(interval);
  }, [examId]);
  
  return (
    <div className="p-6">
      {/* Alert Feed */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Live Alerts</h2>
        {activeAlerts.map(alert => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
      
      {/* Student Scores Table */}
      <div>
        <h2 className="text-xl font-bold mb-4">Student Risk Scores</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th>Student</th>
              <th>Cheating Score</th>
              <th>Risk Level</th>
              <th>Violations</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {studentScores.map(score => (
              <tr key={score.id} className={getRowClass(score.risk_level)}>
                <td>{score.users.full_name}</td>
                <td className="font-bold">{score.overall_score.toFixed(1)}</td>
                <td><RiskBadge level={score.risk_level} /></td>
                <td>{score.total_violations}</td>
                <td><StatusBadge status={score.exam_sessions.status} /></td>
                <td>
                  <button onClick={() => viewStudentDetails(score.session_id)}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 6. API Endpoints

### REST API (via Supabase RPC or Edge Functions)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STUDENT ENDPOINTS                           │
├─────────────────────────────────────────────────────────────────────┤
│ POST   /api/sessions/start              Start exam session          │
│        Body: { exam_id, liveness_data }                             │
│        Returns: { session_id, exam_data }                           │
│                                                                     │
│ POST   /api/sessions/:id/heartbeat       Keep session alive         │
│        Body: { camera_ok, mic_ok }                                  │
│        Returns: { ok: true }                                        │
│                                                                     │
│ POST   /api/sessions/:id/violations     Batch submit violations     │
│        Body: { violations: ViolationEvent[] }                       │
│        Returns: { received: number }                                │
│                                                                     │
│ POST   /api/sessions/:id/submit         Submit exam                 │
│        Body: { answers, duration_taken }                            │
│        Returns: { success, score, report_id }                       │
│                                                                     │
│ GET    /api/sessions/:id/report         Get proctoring report       │
│        Returns: { cheating_score, violations, recommendations }     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       INSTRUCTOR ENDPOINTS                          │
├─────────────────────────────────────────────────────────────────────┤
│ GET    /api/exams/:id/students          Get all students in exam    │
│        Returns: [{ student_id, name, status, cheating_score }]      │
│                                                                     │
│ GET    /api/exams/:id/alerts            Get alerts for exam         │
│        Query: { priority?: 'critical', acknowledged?: false }       │
│        Returns: InstructorAlert[]                                   │
│                                                                     │
│ POST   /api/alerts/:id/acknowledge      Acknowledge alert           │
│        Returns: { success: true }                                   │
│                                                                     │
│ GET    /api/exams/:id/reports           Get all proctoring reports  │
│        Query: { risk_level?, reviewed? }                            │
│        Returns: ProctoringReport[]                                  │
│                                                                     │
│ POST   /api/reports/:id/review          Mark report as reviewed     │
│        Body: { recommendation, notes }                              │
│        Returns: { success: true }                                   │
│                                                                     │
│ GET    /api/exams/:id/analytics         Exam analytics              │
│        Returns: {                                                     │
│          avg_cheating_score,                                         │
│          total_violations,                                           │
│          flagged_students,                                           │
│          violation_breakdown                                         │
│        }                                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       ADMIN ENDPOINTS                               │
├─────────────────────────────────────────────────────────────────────┤
│ GET    /api/admin/audit-log             Get audit trail             │
│        Query: { student_id?, exam_id?, date_range }                 │
│        Returns: AuditLog[]                                          │
│                                                                     │
│ POST   /api/sessions/:id/invalidate     Invalidate exam session     │
│        Body: { reason, admin_id }                                   │
│        Returns: { success: true }                                   │
│                                                                     │
│ GET    /api/admin/export                Export data (CSV/PDF)       │
│        Query: { exam_id?, format: 'csv' | 'pdf' }                   │
│        Returns: File download                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Security & Anti-Cheating Measures

### Row-Level Security (RLS) Policies

```sql
-- Students can only see their own data
CREATE POLICY "Students view own sessions"
ON exam_sessions FOR SELECT
USING (student_id = auth.uid());

-- Students can insert their own violations
CREATE POLICY "Students insert own violations"
ON violation_events FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Instructors can see all sessions for their exams
CREATE POLICY "Instructors view exam sessions"
ON exam_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams 
    WHERE exams.id = exam_sessions.exam_id 
    AND exams.instructor_id = auth.uid()
  )
);

-- Only instructors of an exam can see alerts
CREATE POLICY "Instructors view alerts"
ON instructor_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exams 
    WHERE exams.id = instructor_alerts.exam_id 
    AND exams.instructor_id = auth.uid()
  )
);
```

### Additional Security Measures

1. **IP Address Tracking**:
   - Log IP address at session start
   - Detect IP changes mid-exam
   - Block known proxy/VPN IPs

2. **Browser Fingerprinting**:
   - Store user agent, screen resolution, timezone
   - Detect if session moves to different device

3. **Rate Limiting**:
   - Max 10 violation submissions per minute per student
   - Prevent spam attacks on scoring system

4. **Audit Trail**:
   - Log all database changes
   - Track who reviewed violations and when

5. **Data Encryption**:
   - Encrypt sensitive metadata fields
   - Use HTTPS for all API calls

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Supabase project
- [ ] Create database schema (run migrations)
- [ ] Configure Row-Level Security policies
- [ ] Add Supabase client to React app
- [ ] Implement authentication (email/password)
- [ ] Migrate mock data to database

### Phase 2: Session Management (Week 2-3)
- [ ] Create exam session on exam start
- [ ] Implement session heartbeat endpoint
- [ ] Store student answers in database
- [ ] Handle exam submission and grading
- [ ] Track session duration and status

### Phase 3: Violation Tracking (Week 3-4)
- [ ] Batch violation submission from client
- [ ] Store violation events in database
- [ ] Implement offline queue (retry logic)
- [ ] Add violation review interface for instructors

### Phase 4: Cheating Score Engine (Week 4-5)
- [ ] Create Edge Function for score calculation
- [ ] Implement scoring algorithm (weights, decay)
- [ ] Schedule periodic score updates (every 30s)
- [ ] Store scores in `cheating_scores` table
- [ ] Display risk levels in student exam view

### Phase 5: Real-Time Alerts (Week 5-6)
- [ ] Set up Supabase Realtime subscriptions
- [ ] Implement instructor alert service
- [ ] Create live proctoring dashboard
- [ ] Add browser notifications
- [ ] Implement alert acknowledgment

### Phase 6: Reports & Analytics (Week 6-7)
- [ ] Generate proctoring reports on exam submit
- [ ] Create instructor reports interface
- [ ] Add export to CSV/PDF
- [ ] Implement exam analytics (avg scores, trends)
- [ ] Add instructor review/notes feature

### Phase 7: Testing & Optimization (Week 7-8)
- [ ] Load test with 100+ concurrent students
- [ ] Optimize database queries and indexes
- [ ] Add error handling and monitoring
- [ ] Security audit (penetration testing)
- [ ] User acceptance testing

### Phase 8: Production Deployment (Week 8)
- [ ] Set up production Supabase project
- [ ] Configure environment variables
- [ ] Migrate test data to production
- [ ] Set up monitoring and alerting
- [ ] Documentation and training

---

## Conclusion

**Firebase vs Supabase Verdict**: 

**Supabase is the superior choice** for this project because:
1. ✅ Already in your dependencies
2. ✅ PostgreSQL handles complex violation queries better than Firestore
3. ✅ Row-Level Security provides fine-grained access control
4. ✅ Real-time subscriptions work out of the box
5. ✅ Edge Functions run serverless scoring calculations
6. ✅ More cost-effective for your use case
7. ✅ Better developer experience for relational data

**Next Steps**:
1. Set up Supabase project at https://supabase.com
2. Run the database migration SQL from Section 3
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env`
4. Start implementing Phase 1 (authentication + session management)

Would you like me to start implementing any specific phase or component?
