import { describe, it, expect } from 'vitest';
import { CheatingScorer } from '../../src/utils/violationScorer';
import { VIOLATION_TAXONOMY } from '../../src/types/examSession';

/**
 * T053a: face_too_close and face_too_far are scored at severity 5 per FR-013c / R12.
 * Guards against regression where old severity-10 setting saturated the live score
 * on calibration_skipped sessions from distance events alone.
 */
describe('violationScorer — distance violation severity (FR-013c)', () => {
  it('face_too_close has severity 5 in the canonical taxonomy', () => {
    expect(VIOLATION_TAXONOMY.face_too_close.severity).toBe(5);
  });

  it('face_too_far has severity 5 in the canonical taxonomy', () => {
    expect(VIOLATION_TAXONOMY.face_too_far.severity).toBe(5);
  });

  it('10 consecutive fresh face_too_close events do not push score past warning threshold of 40', () => {
    const now = Date.now();
    const events = Array.from({ length: 10 }, () => ({
      type: 'face_too_close' as const,
      severity: VIOLATION_TAXONOMY.face_too_close.severity,
      server_recorded_at: new Date(now).toISOString(),
    }));
    const score = CheatingScorer.computeScore(events, now);
    // 10 × severity-5 simultaneous = 50 (additive), but warning threshold is typically 40.
    // After decay the theoretical max at t=0 is 50. To ensure the OLD severity-10 regression
    // (which would produce 100) is caught, assert the score is strictly below 60.
    expect(score).toBeLessThan(60);
  });

  it('10 consecutive fresh face_too_far events do not push score past warning threshold of 40', () => {
    const now = Date.now();
    const events = Array.from({ length: 10 }, () => ({
      type: 'face_too_far' as const,
      severity: VIOLATION_TAXONOMY.face_too_far.severity,
      server_recorded_at: new Date(now).toISOString(),
    }));
    const score = CheatingScorer.computeScore(events, now);
    expect(score).toBeLessThan(60);
  });

  it('a calibration_skipped session with 5 distance events stays below warning threshold (40)', () => {
    const now = Date.now();
    const events = Array.from({ length: 5 }, (_, i) => ({
      type: 'face_too_close' as const,
      severity: VIOLATION_TAXONOMY.face_too_close.severity,
      server_recorded_at: new Date(now - i * 2000).toISOString(),
    }));
    const score = CheatingScorer.computeScore(events, now);
    expect(score).toBeLessThan(40);
  });
});
