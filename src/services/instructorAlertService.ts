import { ViolationEvent } from '../utils/violationScorer';
import { InstructorAlertDatabaseService } from './InstructorAlertDatabaseService';
import { getInstructorWebSocketService, hasInstructorWebSocketService } from './WebSocketService';

interface AlertPayload {
  examId: string;
  studentId: string;
  sessionId?: string;
  violationScore: number;
  events: ViolationEvent[];
  timestamp: string;
}

interface AlertResponse {
  success: boolean;
  alertId: string;
}

// Debounce tracking per student
const lastAlertTimePerStudent: Record<string, number> = {};
const DEBOUNCE_INTERVAL_MS = 60000; // 60 seconds

/**
 * Sends a critical alert to the instructor with debouncing, database persistence, and fallback.
 * @param params - Alert parameters
 * @returns Promise with success status and alert ID
 */
export async function sendCriticalAlert(params: {
  examId: string;
  studentId: string;
  sessionId?: string;
  violationScore: number;
  events: ViolationEvent[];
}): Promise<AlertResponse> {
  const { examId, studentId, sessionId, violationScore, events } = params;

  // 1. Debounce check
  const now = Date.now();
  const lastAlertTime = lastAlertTimePerStudent[studentId] || 0;

  if (now - lastAlertTime < DEBOUNCE_INTERVAL_MS) {
    console.warn(
      `[AlertService] Alert debounced for student ${studentId}. Last alert was ${Math.round((now - lastAlertTime) / 1000)}s ago.`
    );
    return {
      success: false,
      alertId: 'debounced'
    };
  }

  const payload: AlertPayload = {
    examId,
    studentId,
    sessionId: sessionId || '',
    violationScore,
    events,
    timestamp: new Date().toISOString()
  };

  let alertId = '';
  let success = false;

  // 2. Persist to database first
  if (sessionId) {
    try {
      const riskLevel = violationScore >= 75 ? 'critical' : violationScore >= 50 ? 'high' : violationScore >= 25 ? 'medium' : 'low';
      const violationSummary = events.slice(-5).map(e => ({
        type: e.type,
        severity: e.severity,
        timestamp: e.timestamp,
        description: e.description,
      }));

      const dbResult = await InstructorAlertDatabaseService.create({
        exam_id: examId,
        session_id: sessionId,
        student_id: studentId,
        alert_type: 'cheating_risk',
        priority: riskLevel === 'critical' ? 'critical' : 'high',
        cheating_score_at_time: violationScore,
        title: `Cheating Risk: ${riskLevel.toUpperCase()}`,
        message: `Student has a ${riskLevel} risk level with score ${violationScore}/100`,
        violation_summary: { events: violationSummary, score: violationScore, level: riskLevel },
      });

      if (dbResult.success && dbResult.alertId) {
        alertId = `db_${dbResult.alertId}`;
        success = true;
        console.log(`[AlertService] Alert persisted to database: ${dbResult.alertId}`);
      }
    } catch (error) {
      console.error('[AlertService] Database alert creation failed:', error);
    }
  }

  // 3. Try WebSocket for real-time delivery
  try {
    const wsSuccess = await sendViaWebSocket(payload);
    if (wsSuccess) {
      success = true;
      if (!alertId) {
        alertId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      console.log(`[AlertService] Alert sent via WebSocket for student ${studentId}`);
    }
  } catch (error) {
    console.warn('[AlertService] WebSocket send failed, falling back to HTTP:', error);
  }

  // 4. Fallback to HTTP if WebSocket failed and DB didn't succeed
  if (!success) {
    try {
      const httpResult = await sendViaHTTP(payload);
      success = httpResult.success;
      alertId = httpResult.alertId;
      console.log(`[AlertService] Alert sent via HTTP for student ${studentId}`);
    } catch (error) {
      console.error('[AlertService] HTTP send failed:', error);
      success = false;
      alertId = 'failed';
    }
  }

  // 5. Update last alert time
  if (success) {
    lastAlertTimePerStudent[studentId] = now;
  }

  return { success, alertId };
}

/**
 * Attempts to send alert via WebSocket connection.
 */
async function sendViaWebSocket(payload: AlertPayload): Promise<boolean> {
  // Try new WebSocketService first
  if (hasInstructorWebSocketService()) {
    const wsService = getInstructorWebSocketService();
    if (wsService.isConnected()) {
      return wsService.send('critical_alert', payload);
    }
  }

  // Fallback to legacy window.instructorSocket
  const instructorSocket = (window as unknown as Record<string, unknown>)[
    'instructorSocket'
  ] as WebSocket | undefined;

  if (!instructorSocket || instructorSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  const message = JSON.stringify({
    type: 'critical_alert',
    payload
  });

  instructorSocket.send(message);
  return true;
}

/**
 * Sends alert via HTTP POST with exponential backoff retries.
 */
async function sendViaHTTP(
  payload: AlertPayload,
  maxRetries: number = 3
): Promise<AlertResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/instructor/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { alertId?: string };
      return {
        success: true,
        alertId: data.alertId || `http_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[AlertService] HTTP attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        lastError.message
      );

      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    alertId: `failed_${lastError?.message ?? 'unknown'}`
  };
}
