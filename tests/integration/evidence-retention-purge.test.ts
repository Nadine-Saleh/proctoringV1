import { describe, it } from 'vitest';

/**
 * T072: expired artifacts with retained_for_case=false are deleted by purge job;
 * bucket objects removed; rows with retained_for_case=true survive.
 *
 * Requires purge-expired-evidence Edge Function. Skipped until deployed.
 */
describe('purge-expired-evidence', () => {
  it.skip('deletes expired artifacts where retained_for_case=false', async () => {
    // Seed: evidence_artifacts row with expires_at < now, retained_for_case=false
    // Invoke purge-expired-evidence function
    // Assert: row deleted, bucket object removed
  });

  it.skip('retains artifacts where retained_for_case=true despite expiry', async () => {
    // Seed: expired artifact with retained_for_case=true
    // Invoke purge
    // Assert: row still exists
  });
});
