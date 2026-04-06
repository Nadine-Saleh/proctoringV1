import { ViolationEvent } from '../utils/violationScorer';

interface AlertPayload {
  examId: string;
  studentId: string;
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
 * Sends a critical alert to the instructor with debouncing and fallback.
 * @param params - Alert parameters
 * @returns Promise with success status and alert ID
 */
export async function sendCriticalAlert(params: {
  examId: string;
  studentId: string;
  violationScore: number;
  events: ViolationEvent[];
}): Promise<AlertResponse> {
  const { examId, studentId, violationScore, events } = params;

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
    violationScore,
    events,
    timestamp: new Date().toISOString()
  };

  let alertId = '';
  let success = false;

  // 2. Try WebSocket first
  try {
    const wsSuccess = await sendViaWebSocket(payload);
    if (wsSuccess) {
      success = true;
      alertId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`[AlertService] Alert sent via WebSocket for student ${studentId}`);
    }
  } catch (error) {
    console.warn('[AlertService] WebSocket send failed, falling back to HTTP:', error);
  }

  // 3. Fallback to HTTP if WebSocket failed
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

  // 4. Update last alert time
  if (success) {
    lastAlertTimePerStudent[studentId] = now;
  }

  return { success, alertId };
}

/**
 * Attempts to send alert via WebSocket connection.
 */
async function sendViaWebSocket(payload: AlertPayload): Promise<boolean> {
  // Check if instructor socket exists and is connected
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
