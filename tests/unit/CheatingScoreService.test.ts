import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheatingScoreTracker } from '../../src/services/CheatingScoreService';

describe('CheatingScoreTracker — live score state management', () => {
  let tracker: CheatingScoreTracker;

  const policy = {
    visual_evidence_allowed: true,
    warning_threshold: 40,
    critical_threshold: 70,
    critical_sustain_seconds: 10,
    max_verification_attempts: 3,
  };

  beforeEach(() => {
    tracker = new CheatingScoreTracker(policy);
  });

  it('starts at score 0 with no thresholds crossed', () => {
    expect(tracker.liveScore).toBe(0);
    expect(tracker.warningThresholdCrossed).toBe(false);
    expect(tracker.criticalThresholdCrossed).toBe(false);
  });

  it('updates score from RPC response', () => {
    tracker.updateFromRpcResponse({ live_cheating_score: 35, crossed_warning_threshold: false, crossed_critical_threshold: false });
    expect(tracker.liveScore).toBe(35);
  });

  it('sets warningThresholdCrossed when RPC says so', () => {
    tracker.updateFromRpcResponse({ live_cheating_score: 45, crossed_warning_threshold: true, crossed_critical_threshold: false });
    expect(tracker.warningThresholdCrossed).toBe(true);
    expect(tracker.criticalThresholdCrossed).toBe(false);
  });

  it('sets criticalThresholdCrossed when RPC says so', () => {
    tracker.updateFromRpcResponse({ live_cheating_score: 75, crossed_warning_threshold: true, crossed_critical_threshold: true });
    expect(tracker.criticalThresholdCrossed).toBe(true);
  });

  it('critical state persists once set (latch behavior)', () => {
    tracker.updateFromRpcResponse({ live_cheating_score: 75, crossed_warning_threshold: true, crossed_critical_threshold: true });
    tracker.updateFromRpcResponse({ live_cheating_score: 65, crossed_warning_threshold: true, crossed_critical_threshold: false });
    expect(tracker.criticalThresholdCrossed).toBe(true);
  });

  it('notifies subscribed listeners on score update', () => {
    const listener = vi.fn();
    tracker.subscribe(listener);
    tracker.updateFromRpcResponse({ live_cheating_score: 50, crossed_warning_threshold: true, crossed_critical_threshold: false });
    expect(listener).toHaveBeenCalledWith({
      score: 50,
      warningThresholdCrossed: true,
      criticalThresholdCrossed: false,
    });
  });

  it('does not call listener after unsubscribe', () => {
    const listener = vi.fn();
    const unsub = tracker.subscribe(listener);
    unsub();
    tracker.updateFromRpcResponse({ live_cheating_score: 50, crossed_warning_threshold: true, crossed_critical_threshold: false });
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset clears score and threshold state', () => {
    tracker.updateFromRpcResponse({ live_cheating_score: 75, crossed_warning_threshold: true, crossed_critical_threshold: true });
    tracker.reset();
    expect(tracker.liveScore).toBe(0);
    expect(tracker.warningThresholdCrossed).toBe(false);
    expect(tracker.criticalThresholdCrossed).toBe(false);
  });
});
