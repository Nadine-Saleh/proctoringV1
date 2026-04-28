import { describe, it } from 'vitest';

/**
 * T070: auto_submit_expired_sessions moves verified/in_progress sessions to
 * auto_submitted with submit_reason='auto_window_close' after the exam window closes.
 *
 * Requires the auto-submit-expired Edge Function to be deployed.
 * Skipped until the test environment has the function available.
 */
describe('auto_submit_expired_sessions', () => {
  it.skip('in_progress session with closed window is auto-submitted', async () => {
    // Seed: exam with window already closed (starts_at + duration < now),
    // session in in_progress
    // Invoke auto-submit-expired function
    // Assert: session.status = 'auto_submitted', submit_reason = 'auto_window_close'
    // Assert: submissions row exists with submit_reason='auto_window_close'
  });

  it.skip('verified session with closed window is auto-submitted', async () => {
    // Seed: same but session in 'verified' status
    // Assert: submission created, session = 'auto_submitted'
  });
});
