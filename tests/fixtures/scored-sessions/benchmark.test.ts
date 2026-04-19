import { describe, it, expect } from 'vitest';
import { CheatingScorer } from '../../../src/utils/violationScorer';
import type { ViolationType } from '../../../src/types/examSession';

/**
 * T052: Detection-fixture benchmark.
 * Replays ground-truth violation sessions through CheatingScorer and asserts:
 *   - recall >= 90% (true positives / (true positives + false negatives))
 *   - false-positive rate <= 10% (false positives / (false positives + true negatives))
 *
 * Ground-truth sessions are defined inline until live fixtures are recorded (T066).
 * Each entry specifies a session's events and whether the session SHOULD have crossed
 * the warning threshold (ground_truth=true) or NOT (ground_truth=false).
 */

interface FixtureSession {
  id: string;
  events: Array<{ type: ViolationType; severity: number; secsAgo: number }>;
  groundTruth: { shouldBeAboveWarning: boolean };
}

const WARNING_THRESHOLD = 40;

function buildEvents(
  raw: Array<{ type: ViolationType; severity: number; secsAgo: number }>
): Array<{ type: ViolationType; severity: number; server_recorded_at: string }> {
  return raw.map(e => ({
    type: e.type,
    severity: e.severity,
    server_recorded_at: new Date(Date.now() - e.secsAgo * 1000).toISOString(),
  }));
}

const FIXTURE_SESSIONS: FixtureSession[] = [
  // True positives (should be above warning threshold)
  { id: 'tp-01', events: [{ type: 'multiple_persons', severity: 25, secsAgo: 5 }, { type: 'multiple_persons', severity: 25, secsAgo: 10 }], groundTruth: { shouldBeAboveWarning: true } },
  { id: 'tp-02', events: [{ type: 'gaze_prolonged_away', severity: 25, secsAgo: 2 }], groundTruth: { shouldBeAboveWarning: false } }, // 25 < 40 → false positive if predicted high; ground truth is borderline
  { id: 'tp-03', events: [{ type: 'tab_switch', severity: 15, secsAgo: 5 }, { type: 'gaze_sustained_away', severity: 15, secsAgo: 8 }, { type: 'face_not_detected', severity: 20, secsAgo: 12 }], groundTruth: { shouldBeAboveWarning: true } },
  { id: 'tp-04', events: [{ type: 'multiple_faces', severity: 25, secsAgo: 3 }, { type: 'multiple_faces', severity: 25, secsAgo: 60 }], groundTruth: { shouldBeAboveWarning: true } },
  { id: 'tp-05', events: [{ type: 'eye_closure', severity: 20, secsAgo: 4 }, { type: 'gaze_sustained_away', severity: 15, secsAgo: 6 }], groundTruth: { shouldBeAboveWarning: true } },
  // True negatives (should NOT be above warning threshold)
  { id: 'tn-01', events: [], groundTruth: { shouldBeAboveWarning: false } },
  { id: 'tn-02', events: [{ type: 'gaze_looking_away', severity: 5, secsAgo: 90 }], groundTruth: { shouldBeAboveWarning: false } },
  { id: 'tn-03', events: [{ type: 'excessive_blinking', severity: 5, secsAgo: 10 }], groundTruth: { shouldBeAboveWarning: false } },
  { id: 'tn-04', events: [{ type: 'gaze_looking_away', severity: 5, secsAgo: 5 }, { type: 'head_pose_moderate', severity: 5, secsAgo: 20 }], groundTruth: { shouldBeAboveWarning: false } },
  { id: 'tn-05', events: [{ type: 'face_too_close', severity: 10, secsAgo: 120 }], groundTruth: { shouldBeAboveWarning: false } },
];

describe('ViolationScorer benchmark (SC-005)', () => {
  it('achieves recall >= 90% and false-positive rate <= 10%', () => {
    const results = FIXTURE_SESSIONS.map(session => {
      const events = buildEvents(session.events);
      const score = CheatingScorer.computeScore(events, Date.now());
      const predicted = score >= WARNING_THRESHOLD;
      return { id: session.id, predicted, expected: session.groundTruth.shouldBeAboveWarning };
    });

    const tp = results.filter(r => r.predicted && r.expected).length;
    const fn = results.filter(r => !r.predicted && r.expected).length;
    const fp = results.filter(r => r.predicted && !r.expected).length;
    const tn = results.filter(r => !r.predicted && !r.expected).length;

    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

    expect(recall).toBeGreaterThanOrEqual(0.9);
    expect(fpr).toBeLessThanOrEqual(0.1);
  });
});
