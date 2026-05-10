import { ViolationType, VIOLATION_TAXONOMY, type ProctoringPolicy } from '../types/examSession';

export type { ViolationEvent } from '../types/examSession';

/**
 * Risk band derived from a numeric cheating score plus the exam's policy
 * thresholds. The band drives UI coloring on instructor surfaces.
 */
export interface RiskLevelInfo {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: 'green' | 'yellow' | 'orange' | 'red';
  shouldAlert: boolean;
}

/**
 * Severity-weighted exponential decay scorer.
 *
 * MUST mirror the formula used by the record_violation_batch RPC
 * (supabase/migrations/006_access_codes_and_submissions.sql) so client-side
 * replays match server-recorded live_cheating_score.
 *
 *   score = sum(severity_i * 2^(-elapsed_seconds_i / HALF_LIFE_SECONDS))
 *
 * The server is always authoritative — this class is only for offline
 * replay (tests, evidence package assembly).
 */
export class CheatingScorer {
  private static readonly HALF_LIFE_SECONDS = 60;
  private static readonly MAX_SCORE = 100;

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
      totalScore += event.severity * Math.pow(2, -elapsedSeconds / this.HALF_LIFE_SECONDS);
    }
    return Math.min(Math.max(totalScore, 0), this.MAX_SCORE);
  }

  static isWarningThresholdCrossed(score: number, policy: ProctoringPolicy): boolean {
    return score >= policy.warning_threshold;
  }

  static isCriticalThresholdCrossed(score: number, policy: ProctoringPolicy): boolean {
    return score >= policy.critical_threshold;
  }
}

/**
 * Map a numeric score to a risk band using policy thresholds where
 * available. Falls back to the canonical defaults (warning=40,
 * critical=70) so legacy callers without a policy still get UI parity
 * with the instructor dashboard.
 */
export function getRiskLevel(
  score: number,
  policy?: Pick<ProctoringPolicy, 'warning_threshold' | 'critical_threshold'>
): RiskLevelInfo {
  const warn = policy?.warning_threshold ?? 40;
  const crit = policy?.critical_threshold ?? 70;
  const mediumFloor = Math.max(0, warn / 2);

  let level: RiskLevelInfo['level'];
  let color: RiskLevelInfo['color'];

  if (score >= crit) {
    level = 'critical';
    color = 'red';
  } else if (score >= warn) {
    level = 'high';
    color = 'orange';
  } else if (score >= mediumFloor) {
    level = 'medium';
    color = 'yellow';
  } else {
    level = 'low';
    color = 'green';
  }

  return { level, color, shouldAlert: level === 'critical' };
}

export function validateViolationType(type: string): boolean {
  return type in VIOLATION_TAXONOMY;
}
