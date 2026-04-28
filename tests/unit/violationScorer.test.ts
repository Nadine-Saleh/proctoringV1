import { describe, it, expect } from 'vitest';
import { CheatingScorer } from '../../src/utils/violationScorer';
import type { ViolationType } from '../../src/types/examSession';

const eventAt = (type: ViolationType, severity: number, secsAgo: number) => ({
  type,
  severity,
  server_recorded_at: new Date(Date.now() - secsAgo * 1000).toISOString(),
});

describe('CheatingScorer.computeScore — exponential decay math', () => {
  it('severity-5 event at t=0 contributes exactly 5 to score', () => {
    const events = [eventAt('gaze_looking_away', 5, 0)];
    const score = CheatingScorer.computeScore(events, Date.now());
    expect(score).toBeCloseTo(5, 1);
  });

  it('severity-5 event decays to ~2.5 after 60 s (one half-life)', () => {
    const events = [eventAt('gaze_looking_away', 5, 60)];
    const score = CheatingScorer.computeScore(events, Date.now());
    expect(score).toBeCloseTo(2.5, 1);
  });

  it('severity-5 event decays to ~1.25 after 120 s (two half-lives)', () => {
    const events = [eventAt('gaze_looking_away', 5, 120)];
    const score = CheatingScorer.computeScore(events, Date.now());
    expect(score).toBeCloseTo(1.25, 1);
  });

  it('two simultaneous severity-5 events are additive', () => {
    const now = Date.now();
    const events = [
      { type: 'gaze_looking_away' as ViolationType, severity: 5, server_recorded_at: new Date(now).toISOString() },
      { type: 'tab_focus_lost' as ViolationType, severity: 5, server_recorded_at: new Date(now).toISOString() },
    ];
    const score = CheatingScorer.computeScore(events, now);
    expect(score).toBeCloseTo(10, 1);
  });

  it('score is clamped to 100 regardless of many high-severity simultaneous events', () => {
    const now = Date.now();
    const events = Array.from({ length: 20 }, (_) => ({
      type: 'multiple_persons' as ViolationType,
      severity: 25,
      server_recorded_at: new Date(now).toISOString(),
    }));
    const score = CheatingScorer.computeScore(events, now);
    expect(score).toBe(100);
  });

  it('score is 0 for an empty event list', () => {
    const score = CheatingScorer.computeScore([], Date.now());
    expect(score).toBe(0);
  });

  it('score is never negative', () => {
    const events = [eventAt('gaze_looking_away', 5, 3600)]; // 1 hour ago
    const score = CheatingScorer.computeScore(events, Date.now());
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('CheatingScorer threshold helpers', () => {
  const policy = {
    visual_evidence_allowed: true,
    warning_threshold: 40,
    critical_threshold: 70,
    critical_sustain_seconds: 10,
    max_verification_attempts: 3,
  };

  it('isWarningThresholdCrossed returns false below threshold', () => {
    expect(CheatingScorer.isWarningThresholdCrossed(39, policy)).toBe(false);
  });

  it('isWarningThresholdCrossed returns true at and above threshold', () => {
    expect(CheatingScorer.isWarningThresholdCrossed(40, policy)).toBe(true);
    expect(CheatingScorer.isWarningThresholdCrossed(55, policy)).toBe(true);
  });

  it('isCriticalThresholdCrossed returns false below threshold', () => {
    expect(CheatingScorer.isCriticalThresholdCrossed(69, policy)).toBe(false);
  });

  it('isCriticalThresholdCrossed returns true at and above threshold', () => {
    expect(CheatingScorer.isCriticalThresholdCrossed(70, policy)).toBe(true);
    expect(CheatingScorer.isCriticalThresholdCrossed(95, policy)).toBe(true);
  });
});
