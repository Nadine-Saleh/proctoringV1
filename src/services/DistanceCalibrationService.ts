import {
  IdentityVerificationService,
  type StartSessionCalibration,
  type StartSessionResponse,
} from './IdentityVerificationService';

const DEFAULT_TOLERANCE_CM = 15;

export type CalibrationPayload = StartSessionCalibration;

export interface SubmitCalibrationResult {
  success: boolean;
  data?: StartSessionResponse;
  error?: string;
  errorCode?: 'calibration_invalid' | 'session_not_found' | 'session_not_verified' | 'exam_window_closed' | 'unknown';
}

function classifyError(message: string | undefined): SubmitCalibrationResult['errorCode'] {
  if (!message) return 'unknown';
  if (message.includes('calibration_invalid')) return 'calibration_invalid';
  if (message.includes('session_not_found')) return 'session_not_found';
  if (message.includes('session_not_verified')) return 'session_not_verified';
  if (message.includes('exam_window_closed')) return 'exam_window_closed';
  return 'unknown';
}

export class DistanceCalibrationService {
  /**
   * Build the calibration payload for a successfully calibrated student.
   * Tolerance defaults to ±15 cm per FR-013a.
   */
  static fromCalibratedDistance(
    optimalDistanceCm: number,
    toleranceCm: number = DEFAULT_TOLERANCE_CM
  ): CalibrationPayload {
    return {
      calibration_skipped: false,
      optimal_distance_cm: optimalDistanceCm,
      distance_tolerance_cm: toleranceCm,
    };
  }

  /**
   * Build the fallback payload for a student whose calibration could not
   * complete. The server writes the conservative defaults `50 / 20` and flags
   * the session via `calibration_skipped = true` per FR-013b.
   */
  static asSkipped(): CalibrationPayload {
    return { calibration_skipped: true };
  }

  /**
   * Transition `verified → in_progress` and persist the per-session calibration
   * baseline. Wraps `start_exam_session` (see contracts/rpc-start-session.md).
   */
  static async submitCalibration(
    sessionId: string,
    payload: CalibrationPayload
  ): Promise<SubmitCalibrationResult> {
    const result = await IdentityVerificationService.startSession(sessionId, payload);
    if (!result.success) {
      return { success: false, error: result.error, errorCode: classifyError(result.error) };
    }
    return { success: true, data: result.data };
  }
}
