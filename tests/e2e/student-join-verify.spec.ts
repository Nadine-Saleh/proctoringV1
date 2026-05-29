import { test, expect } from '@playwright/test';

/**
 * T034: E2E — Student enters access code, completes reference capture (first time),
 * passes verification, and lands on the ready screen.
 */
test.describe('Student join and verify flow', () => {
  const INSTRUCTOR_EMAIL = process.env.TEST_INSTRUCTOR_EMAIL ?? 'e2e-instructor@example.com';
  const INSTRUCTOR_PASSWORD = process.env.TEST_INSTRUCTOR_PASSWORD ?? 'TestPassword123!';
  const STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL ?? 'e2e-student@example.com';
  const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD ?? 'TestPassword123!';

  let examAccessCode: string;

  test.beforeAll(async ({ browser }) => {
    // Create and publish a test exam as instructor
    const instructorPage = await browser.newPage();
    await instructorPage.goto('/login');
    await instructorPage.getByLabel(/email/i).fill(INSTRUCTOR_EMAIL);
    await instructorPage.getByLabel(/password/i).fill(INSTRUCTOR_PASSWORD);
    await instructorPage.getByRole('button', { name: /sign in/i }).click();

    await instructorPage.waitForURL(/\/instructor/);
    await instructorPage.goto('/instructor/exams/new');

    await instructorPage.getByLabel(/exam title/i).fill('E2E Verification Test Exam');
    await instructorPage.getByLabel(/duration/i).fill('60');

    // Fill first question
    await instructorPage.getByPlaceholder(/enter your question/i).first().fill('What is 2+2?');
    await instructorPage.getByPlaceholder(/option 1/i).fill('3');
    await instructorPage.getByPlaceholder(/option 2/i).fill('4');
    await instructorPage.getByPlaceholder(/option 3/i).fill('5');
    await instructorPage.getByPlaceholder(/option 4/i).fill('6');

    await instructorPage.getByRole('button', { name: /create & publish/i }).click();

    // Capture access code from success message or detail page
    await instructorPage.waitForURL(/\/instructor\/exams\//);
    const codeEl = await instructorPage.locator('[data-testid="access-code"]').first();
    examAccessCode = await codeEl.textContent() ?? '';
    expect(examAccessCode).toMatch(/^[0-9A-HJ-NPR-Z]{8}$/);

    await instructorPage.close();
  });

  test('student can join with valid code and reach verify page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('/');

    await page.getByRole('button', { name: /join exam/i }).click();
    await page.waitForURL('/exam/join');

    await page.getByLabel(/access code/i).fill(examAccessCode);
    await page.getByRole('button', { name: /join/i }).click();

    await page.waitForURL(/\/exam\/.+\/verify/);
    await expect(page.getByText(/identity verification/i)).toBeVisible();
  });

  test('student sees reference capture step when no prior reference exists', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.goto('/exam/join');
    await page.getByLabel(/access code/i).fill(examAccessCode);
    await page.getByRole('button', { name: /join/i }).click();

    await page.waitForURL(/\/exam\/.+\/verify/);
    await expect(
      page.getByText(/capture your face|reference capture|set up face/i)
    ).toBeVisible();
  });

  test('student lands on ready screen after successful verification', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.goto('/exam/join');
    await page.getByLabel(/access code/i).fill(examAccessCode);
    await page.getByRole('button', { name: /join/i }).click();

    await page.waitForURL(/\/exam\/.+\/verify/);

    // Trigger reference capture (fake media stream is provided by Playwright config)
    const captureBtn = page.getByRole('button', { name: /capture|take photo|start capture/i });
    if (await captureBtn.isVisible()) {
      await captureBtn.click();
      await page.waitForTimeout(2000);
    }

    // Trigger verification
    const verifyBtn = page.getByRole('button', { name: /verify|confirm identity/i });
    await verifyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await verifyBtn.click();

    await page.waitForURL(/\/exam\/.+\/ready/, { timeout: 15000 });
    await expect(page.getByText(/ready to start|you are verified/i)).toBeVisible();
  });
});
