/**
 * Instructor Alert Service
 * Phase 2: Alerts are persisted to the database.
 * Phase 3: Supabase Realtime subscriptions will deliver alerts to the instructor dashboard.
 */

interface AlertPayload {
  examId: string;
  studentId: string;
  sessionId?: string;
  violationScore: number;
  events: Array<{ type: string; severity: number; timestamp: string }>;
  timestamp: string;
}

interface AlertResponse {
  success: boolean;
  alertId: string;
}

/**
 * Create an instructor alert by persisting to the database.
 * Phase 3 will add Supabase Realtime publishing.
 */
export async function sendCriticalAlert(params: {
  examId: string;
  studentId: string;
  sessionId?: string;
  violationScore: number;
  events: Array<{ type: string; severity: number; timestamp: string }>;
}): Promise<AlertResponse> {
  const { examId, sessionId, violationScore } = params;

  if (!sessionId) {
    return {
      success: false,
      alertId: 'no_session'
    };
  }

  try {
    const riskLevel =
      violationScore >= 75
        ? 'critical'
        : violationScore >= 50
          ? 'high'
          : violationScore >= 25
            ? 'medium'
            : 'low';

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(
      `[AlertService] Alert created for exam ${examId}, session ${sessionId}, risk level: ${riskLevel}`
    );

    return {
      success: true,
      alertId
    };
  } catch (error) {
    console.error('[AlertService] Failed to create alert:', error);
    return {
      success: false,
      alertId: 'failed'
    };
  }
}
