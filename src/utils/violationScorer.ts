export type ViolationType =
  | 'gaze_looking_away'
  | 'gaze_sustained_away'
  | 'gaze_prolonged_away'
  | 'eye_closure'
  | 'excessive_blinking'
  | 'rapid_eye_movement'
  | 'face_not_detected'
  | 'multiple_faces'
  | 'face_too_close'
  | 'face_too_far'
  | 'tab_switch'
  | 'tab_switch_prolonged'
  | 'window_minimize'
  | 'head_pose_extreme'
  | 'head_pose_moderate'
  | 'phone_detected'
  | 'headphones_detected'
  | 'answer_pattern_suspicious'
  | 'ip_address_change';

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ViolationEvent {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  timestamp: string; // ISO string
  duration?: number;
  description: string;
  metadata?: Record<string, unknown>;
  evidenceImage?: string | null; // Base64 encoded snapshot or null
}

export const WEIGHTS: Record<ViolationType, number> = {
  gaze_looking_away: 2,
  gaze_sustained_away: 5,
  multiple_faces: 10,
  tab_switch: 3,
  excessive_blinking: 1,
  phone_detected: 8,
  head_pose_extreme: 4,
  face_too_close: 3,
  face_too_far: 3,
  face_not_detected: 6,
  gaze_prolonged_away: 7,
  eye_closure: 4,
  rapid_eye_movement: 3,
  tab_switch_prolonged: 6,
  window_minimize: 4,
  head_pose_moderate: 2,
  headphones_detected: 5,
  answer_pattern_suspicious: 9,
  ip_address_change: 7
};

export interface ViolationScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  recentEvents: ViolationEvent[];
}

export interface RiskLevelInfo {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: 'green' | 'yellow' | 'orange' | 'red';
  shouldAlert: boolean;
}

/**
 * Calculates a weighted violation score based on recent events.
 * @param events - Array of violation events
 * @param timeWindowMs - Time window in milliseconds (default: 5 minutes)
 * @returns Normalized score (0-100), risk level, and recent events
 */
export function calculateViolationScore(
  events: ViolationEvent[],
  timeWindowMs: number = 300000 // 5 mins
): ViolationScoreResult {
  const now = Date.now();
  const windowStart = now - timeWindowMs;

  // Filter events within the time window
  const recentEvents = events.filter(
    (event) => new Date(event.timestamp).getTime() >= windowStart
  );

  // Sum weights of recent events
  const totalWeight = recentEvents.reduce((sum, event) => {
    return sum + (WEIGHTS[event.type] || 0);
  }, 0);

  // Calculate maximum possible weight for normalization
  // Estimate: max reasonable events in window is ~20, with average weight ~5
  // So max raw score would be ~100, we normalize accordingly
  const maxExpectedWeight = 100;
  const normalizedScore = Math.min(100, Math.round((totalWeight / maxExpectedWeight) * 100));

  // Determine high-severity events in last 2 minutes
  const twoMinutesAgo = now - 120000;
  const highSeverityRecent = recentEvents.filter(
    (event) =>
      event.severity === 'high' &&
      new Date(event.timestamp).getTime() >= twoMinutesAgo
  );

  // Determine critical-severity events in last 5 minutes
  const criticalSeverityRecent = recentEvents.filter(
    (event) => event.severity === 'critical'
  );

  // Determine risk level with enhanced thresholds
  let level: 'low' | 'medium' | 'high' | 'critical';

  if (normalizedScore >= 75 || criticalSeverityRecent.length >= 2 || (normalizedScore >= 60 && highSeverityRecent.length >= 3)) {
    level = 'critical';
  } else if (normalizedScore >= 50 || highSeverityRecent.length >= 2) {
    level = 'high';
  } else if (normalizedScore >= 25) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score: normalizedScore,
    level,
    recentEvents
  };
}

/**
 * Gets the risk level information with color and alert flag.
 * @param score - The violation score (0-100)
 * @returns Risk level info with color and alert recommendation
 */
export function getRiskLevel(score: number): RiskLevelInfo {
  let level: 'low' | 'medium' | 'high' | 'critical';
  let color: 'green' | 'yellow' | 'orange' | 'red';

  if (score >= 80) {
    level = 'critical';
    color = 'red';
  } else if (score >= 60) {
    level = 'high';
    color = 'orange';
  } else if (score >= 30) {
    level = 'medium';
    color = 'yellow';
  } else {
    level = 'low';
    color = 'green';
  }

  // Should alert only if critical AND pattern detected (score is very high)
  const shouldAlert = level === 'critical' && score >= 85;

  return {
    level,
    color,
    shouldAlert
  };
}
