import { describe, it } from 'vitest';

/**
 * T071: After submission, an evidence_packages row exists with violation_summary
 * matching the violation_events aggregate; a submission_ready Realtime event fires.
 *
 * Requires Edge Function deployment. Skipped until available.
 */
describe('submit-exam evidence package assembly', () => {
  it.skip('evidence_packages row is created with violation_summary after submission', async () => {
    // Seed: in_progress session with 3 violation_events (2 gaze, 1 tab_focus_lost)
    // Submit via Edge Function
    // Assert: evidence_packages row exists for session_id
    // Assert: violation_summary.gaze_off_screen.count = 2
    // Assert: violation_summary.tab_focus_lost.count = 1
  });

  it.skip('submission_ready Realtime event fires on the oversight channel', async () => {
    // Subscribe to oversight:exam:<examId>
    // Submit
    // Assert: UPDATE event received on exam_sessions with status='submitted'
  });
});
