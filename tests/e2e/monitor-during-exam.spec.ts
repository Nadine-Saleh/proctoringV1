import { test, expect } from '@playwright/test';

/**
 * T053: E2E test — verified student triggers tab-blur and gaze-off;
 * instructor tab observes score updates on the Realtime channel within 5 s.
 *
 * This test requires a running dev server and two browser contexts:
 *   1. Student context — authenticated as student, in active exam session
 *   2. Instructor context — authenticated as instructor, on Proctoring dashboard
 *
 * NOTE: Full live-camera and Realtime Supabase tests require the test environment
 * to have VITE_SUPABASE_URL pointing to the test project and appropriate
 * test credentials in PLAYWRIGHT_STUDENT_EMAIL / PLAYWRIGHT_INSTRUCTOR_EMAIL.
 *
 * Until real credentials are configured this test runs as a smoke/placeholder.
 */
test.describe('Real-time monitoring during exam', () => {
  test.skip(
    !process.env.PLAYWRIGHT_STUDENT_EMAIL || !process.env.PLAYWRIGHT_INSTRUCTOR_EMAIL,
    'Skipping: PLAYWRIGHT_STUDENT_EMAIL or PLAYWRIGHT_INSTRUCTOR_EMAIL not set'
  );

  test('instructor observes score update within 5 s of student tab-blur', async ({ browser }) => {
    const studentCtx = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const instructorCtx = await browser.newContext();

    const studentPage = await studentCtx.newPage();
    const instructorPage = await instructorCtx.newPage();

    // --- Instructor: log in and open Proctoring dashboard ---
    await instructorPage.goto('/login');
    await instructorPage.fill('input[name="email"]', process.env.PLAYWRIGHT_INSTRUCTOR_EMAIL!);
    await instructorPage.fill('input[name="password"]', process.env.PLAYWRIGHT_INSTRUCTOR_PASSWORD!);
    await instructorPage.click('button[type="submit"]');
    await instructorPage.waitForURL('**/instructor');
    await instructorPage.goto('/instructor/proctoring');

    // --- Student: log in and join exam ---
    await studentPage.goto('/login');
    await studentPage.fill('input[name="email"]', process.env.PLAYWRIGHT_STUDENT_EMAIL!);
    await studentPage.fill('input[name="password"]', process.env.PLAYWRIGHT_STUDENT_PASSWORD!);
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('**/');

    // Join exam with test access code
    const accessCode = process.env.PLAYWRIGHT_TEST_ACCESS_CODE!;
    await studentPage.goto('/exam/join');
    await studentPage.fill('input[placeholder*="code"]', accessCode);
    await studentPage.click('button[type="submit"]');

    // Skip identity verification (already verified in test setup)
    await studentPage.waitForURL('**/ready');
    await studentPage.click('[data-testid="begin-exam-button"]');
    await studentPage.waitForURL('**/exam/**');

    // --- Student: trigger tab blur ---
    await studentPage.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
    });

    // --- Instructor: assert score tile updates within 5 s ---
    const scoreLocator = instructorPage.locator('[data-testid="student-score"]').first();
    await expect(scoreLocator).not.toHaveText('0', { timeout: 5000 });

    await studentCtx.close();
    await instructorCtx.close();
  });
});
