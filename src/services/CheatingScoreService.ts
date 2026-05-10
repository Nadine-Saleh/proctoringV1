import type { ProctoringPolicy } from '../types/examSession';

export interface RpcScoreResponse {
  live_cheating_score: number;
  crossed_warning_threshold: boolean;
  crossed_critical_threshold: boolean;
}

export interface ScoreState {
  score: number;
  warningThresholdCrossed: boolean;
  criticalThresholdCrossed: boolean;
}

type ScoreListener = (state: ScoreState) => void;

/**
 * Reactive score tracker for a single exam session.
 *
 * The authoritative cheating score is computed server-side by the
 * record_violation_batch RPC (see migration 006) and persisted on
 * exam_sessions.live_cheating_score. This tracker mirrors the score the
 * server returned on the most recent batch — clients MUST NOT compute
 * their own score.
 *
 * Threshold crossings latch (once true, they stay true) so transient
 * dips below threshold do not clear the warning UI.
 */
export class CheatingScoreTracker {
  private _score = 0;
  private _warnCrossed = false;
  private _critCrossed = false;
  private _listeners = new Set<ScoreListener>();

  constructor(_policy: Pick<ProctoringPolicy, 'warning_threshold' | 'critical_threshold'>) {}

  get liveScore(): number { return this._score; }
  get warningThresholdCrossed(): boolean { return this._warnCrossed; }
  get criticalThresholdCrossed(): boolean { return this._critCrossed; }

  updateFromRpcResponse(res: RpcScoreResponse): void {
    this._score = res.live_cheating_score;
    if (res.crossed_warning_threshold) this._warnCrossed = true;
    if (res.crossed_critical_threshold) this._critCrossed = true;

    const state: ScoreState = {
      score: this._score,
      warningThresholdCrossed: this._warnCrossed,
      criticalThresholdCrossed: this._critCrossed,
    };
    this._listeners.forEach(fn => fn(state));
  }

  subscribe(listener: ScoreListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  reset(): void {
    this._score = 0;
    this._warnCrossed = false;
    this._critCrossed = false;
  }
}
