import { ViolationType, VIOLATION_TAXONOMY } from '../types/examSession';

/**
 * Proctoring policy configuration affecting scoring thresholds.
 * Read from the exam's proctoring_policy field at score computation time.
 */
export interface ProctoringPolicy {
  visual_evidence_allowed: boolean;
  warning_threshold: number; // score threshold for warning banner (typically 30)
  critical_threshold: number; // score threshold for critical alert (typically 70)
  critical_sustain_seconds: number; // duration score must stay above critical (typically 5)
  max_verification_attempts: number; // max face-verification retries (typically 3)
}

/**
 * Severity-weighted exponential decay scorer.
 *
 * Formula: score = sum(severity_i * 2^(-t_i / HALF_LIFE_SECONDS))
 *
 * Each violation event contributes a decaying value based on:
 * - Its severity (1-25, from the canonical taxonomy)
 * - Time elapsed since it occurred (half-life = 60 seconds)
 *
 * Final score is clamped to [0, 100].
 */
export class CheatingScorer {
  private static readonly HALF_LIFE_SECONDS = 60;
  private static readonly MAX_SCORE = 100;

  /**
   * Compute the cheating score given a list of violation events.
   * @param events Array of violation events with type, severity, and server_recorded_at timestamp
   * @param nowMs Current time in milliseconds (default: Date.now())
   * @returns Cheating score clamped to [0, 100]
   */
  static computeScore(
    events: Array<{
      type: ViolationType;
      severity: number;
      server_recorded_at: string;
    }>,
    nowMs: number = Date.now()
  ): number {
    let totalScore = 0;

    for (const event of events) {
      const elapsedSeconds = (nowMs - new Date(event.server_recorded_at).getTime()) / 1000;

      // Exponential decay: severity * 2^(-elapsed / half_life)
      const decayedValue = event.severity * Math.pow(2, -elapsedSeconds / this.HALF_LIFE_SECONDS);

      totalScore += decayedValue;
    }

    // Clamp to [0, 100]
    return Math.min(Math.max(totalScore, 0), this.MAX_SCORE);
  }

  /**
   * Check if the score has crossed the warning threshold.
   */
  static isWarningThresholdCrossed(
    score: number,
    policy: ProctoringPolicy
  ): boolean {
    return score >= policy.warning_threshold;
  }

  /**
   * Check if the score has crossed the critical threshold.
   */
  static isCriticalThresholdCrossed(
    score: number,
    policy: ProctoringPolicy
  ): boolean {
    return score >= policy.critical_threshold;
  }
}

/**
 * Validates a violation type against the canonical taxonomy.
 */
export function validateViolationType(type: string): boolean {
  return type in VIOLATION_TAXONOMY;
}

// ============================================================================
// Backward Compatibility Exports (Phase 2→3 transition)
// ============================================================================

export type { ViolationEvent } from '../types/examSession';

/**
 * Legacy RiskLevelInfo interface for backward compatibility
 */
export interface RiskLevelInfo {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: 'green' | 'yellow' | 'orange' | 'red';
  shouldAlert: boolean;
}

/**
 * Legacy getRiskLevel function (stub for compatibility)
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

  return {
    level,
    color,
    shouldAlert: level === 'critical' && score >= 85
  };
}

/**
 * Legacy calculateViolationScore function (stub for compatibility)
 */
export function calculateViolationScore(
  events: Array<{
    type?: string;
    severity?: string | number;
    timestamp?: string;
    id?: string;
    session_id?: string;
    client_event_id?: string;
    server_recorded_at?: string;
  }>,
  timeWindowMs: number = 300000
): { score: number; level: 'low' | 'medium' | 'high' | 'critical'; recentEvents: any[] } {
  const now = Date.now();
  const windowStart = now - timeWindowMs;

  const recentEvents = events.filter((event) => {
    const timestamp = event.timestamp || event.server_recorded_at;
    if (!timestamp) return false;
    return new Date(timestamp).getTime() >= windowStart;
  });

  const score = Math.min(100, recentEvents.length * 5);
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';

  return { score, level, recentEvents };
}
