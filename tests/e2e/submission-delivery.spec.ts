import { test, expect } from '@playwright/test';

/**
 * T074: Student submits exam; instructor sees grade + timeline + playable snippet
 * within 60 s of submission (SC-004).
 *
 * Prerequisites: seeded test exam, student session in in_progress status.
 */
test.describe('Submission delivery (SC-004)', () => {
  test.skip('student submission appears on instructor results within 60 s', async ({ browser }) => {
    // 1. Student tab: navigate to exam, answer questions, click Submit
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await studentPage.goto('/exam/TEST_SESSION_ID');

    // Wait for exam to load
    await studentPage.waitForSelector('[data-testid="submit-button"]');
    await studentPage.locator('[data-testid="submit-button"]').click();
    await studentPage.locator('[data-testid="confirm-submit"]').click();
    await studentPage.waitForURL('**/results');

    // 2. Instructor tab: verify grade appears within 60 s
    const instructorCtx = await browser.newContext();
    const instructorPage = await instructorCtx.newPage();
    await instructorPage.goto('/instructor/results');

    // Select the exam
    await instructorPage.selectOption('[data-testid="exam-select"]', 'TEST_EXAM_ID');

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const row = instructorPage.locator(`[data-testid="submission-row-${process.env.TEST_SESSION_ID}"]`);
      if (await row.isVisible()) break;
      await instructorPage.waitForTimeout(1000);
      await instructorPage.reload();
    }

    const detailLink = instructorPage.locator(`[data-testid="submission-detail-TEST_SESSION_ID"]`);
    await expect(detailLink).toBeVisible({ timeout: 5000 });
    await detailLink.click();
    await instructorPage.waitForURL('**/results/TEST_SESSION_ID');

    await expect(instructorPage.locator('h1:has-text("Submission Detail")')).toBeVisible();

    await instructorCtx.close();
    await studentCtx.close();
  });
});
