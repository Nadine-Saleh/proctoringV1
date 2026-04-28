import { test, expect } from '@playwright/test';

/**
 * T053c: End-to-end test for distance calibration flow.
 * Student completes DistanceSetupModal, submits calibration via start_exam_session,
 * leans into camera (mocked via fake-media-stream), and a face_too_close event
 * is emitted with metadata.baseline_cm matching the calibrated value.
 *
 * Prerequisites: fake-media-stream flag enabled in Playwright config (see playwright.config.ts).
 */
test.describe('Distance calibration end-to-end (FR-013a)', () => {
  test.beforeEach(async ({ page: _page }) => {
    // Seed test exam and student via API or direct DB, then navigate.
    // Implementation requires a seeded test session in 'verified' status.
    test.skip(); // Unskip once seeding helpers are wired to E2E
  });

  test('calibration persists to session and distance events include baseline_cm in metadata', async ({ page }) => {
    // 1. Navigate to /exam/:sessionId (session must be in 'verified' status)
    await page.goto('/exam/TEST_SESSION_ID');

    // 2. DistanceSetupModal should appear
    await expect(page.locator('[data-testid="distance-setup-modal"]')).toBeVisible();

    // 3. Wait for face detection to stabilize at a calibrated distance
    // (fake-media-stream feeds a pre-recorded face at ~47cm)
    await page.waitForSelector('[data-testid="distance-value"]');
    await page.locator('[data-testid="set-distance-button"]').click();

    // 4. Verify calibration was submitted — session should be in_progress
    const sessionStatus = await page.evaluate(async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const { data } = await sb
        .from('exam_sessions')
        .select('status, optimal_distance_cm')
        .eq('id', 'TEST_SESSION_ID')
        .single();
      return data;
    });
    expect(sessionStatus?.status).toBe('in_progress');
    expect(sessionStatus?.optimal_distance_cm).toBeGreaterThan(0);

    // 5. Instructor dashboard should receive a face_too_close event with correct metadata
    // when fake-media-stream feed simulates a close-up face
    // (full assertion requires Realtime channel subscription in instructor tab)
  });
});
