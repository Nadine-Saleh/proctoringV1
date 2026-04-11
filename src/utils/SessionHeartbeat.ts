// ============================================
// Phase 2: Session Heartbeat Utility
// ============================================
// Sends periodic keep-alive signals to the server
// Responsibility: Maintain session liveness, detect disconnections

import { supabase } from '../lib/supabase/client';
import type { HeartbeatStatus } from '../types/examSession';

const DEFAULT_INTERVAL_MS = 30000; // 30 seconds
const MAX_MISSED_BEATS = 3; // Allow 3 missed heartbeats before declaring inactive

export class SessionHeartbeat {
  private sessionId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat: string | null = null;
  private missedBeats = 0;
  private intervalMs: number;
  private onHeartbeatSuccess?: () => void;
  private onHeartbeatFailure?: (error: string) => void;
  private onSessionTimeout?: () => void;

  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  /**
   * Start sending heartbeats for a session
   */
  start(sessionId: string, callbacks?: {
    onSuccess?: () => void;
    onFailure?: (error: string) => void;
    onTimeout?: () => void;
  }): void {
    if (this.isActive) {
      console.warn('[SessionHeartbeat] Already active, stopping first');
      this.stop();
    }

    this.sessionId = sessionId;
    this.lastHeartbeat = null;
    this.missedBeats = 0;
    this.onHeartbeatSuccess = callbacks?.onSuccess;
    this.onHeartbeatFailure = callbacks?.onFailure;
    this.onSessionTimeout = callbacks?.onTimeout;

    console.log(`[SessionHeartbeat] Starting for session ${sessionId} (every ${this.intervalMs}ms)`);

    // Send initial heartbeat
    this.sendHeartbeat();

    // Start interval
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);
  }

  /**
   * Stop sending heartbeats
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.sessionId = null;
    this.lastHeartbeat = null;
    this.missedBeats = 0;

    console.log('[SessionHeartbeat] Stopped');
  }

  /**
   * Send a single heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({
          // Update a simple field to show session is still alive
          // In production, you might have a dedicated heartbeat table
          user_agent: navigator.userAgent,
        } as any)
        .eq('id', this.sessionId)
        .eq('status', 'in_progress'); // Only update if still in progress

      if (error) {
        this.missedBeats++;
        console.warn(`[SessionHeartbeat] Missed heartbeat ${this.missedBeats}/${MAX_MISSED_BEATS}:`, error.message);

        this.onHeartbeatFailure?.(error.message);

        if (this.missedBeats >= MAX_MISSED_BEATS) {
          console.error('[SessionHeartbeat] Max missed beats reached');
          this.onSessionTimeout?.();
        }
        return;
      }

      // Reset missed beats counter on success
      this.missedBeats = 0;
      this.lastHeartbeat = new Date().toISOString();

      this.onHeartbeatSuccess?.();
    } catch (err) {
      this.missedBeats++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SessionHeartbeat] Unexpected error:', err);
      this.onHeartbeatFailure?.(message);
    }
  }

  /**
   * Get current heartbeat status
   */
  getStatus(): HeartbeatStatus {
    return {
      is_active: this.isActive,
      last_heartbeat: this.lastHeartbeat,
      session_id: this.sessionId,
      interval_ms: this.intervalMs,
    };
  }

  /**
   * Check if heartbeat is currently active
   */
  get isActive(): boolean {
    return this.intervalId !== null && this.sessionId !== null;
  }

  /**
   * Check how many heartbeats have been missed consecutively
   */
  get missedBeatCount(): number {
    return this.missedBeats;
  }
}
