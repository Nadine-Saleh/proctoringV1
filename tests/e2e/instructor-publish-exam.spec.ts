import { test, expect } from '@playwright/test';

/**
 * E2E test for instructor exam creation and publication flow.
 * Tests the full user journey:
 * 1. Log in as instructor
 * 2. Fill create-exam form
 * 3. Add questions
 * 4. Publish
 * 5. Verify access code is visible on exam detail page
 */
test.describe('Instructor Publish Exam Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');
  });

  test('should create, fill, and publish an exam with visible access code', async ({
    page,
  }) => {
    // TODO: Replace with actual instructor account login
    // For now, this test is a placeholder showing the expected flow

    // Step 1: Navigate to exam creation
    await page.goto('/instructor/exams/new');

    // Step 2: Fill exam details
    await page.fill('input[name="title"]', 'Integration Test Exam');
    await page.fill('textarea[name="description"]', 'Test exam for E2E validation');

    // Step 3: Set exam window
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 1);
    await page.fill('input[name="starts_at"]', startDate.toISOString());
    await page.fill('input[name="duration_minutes"]', '60');

    // Step 4: Configure proctoring policy
    await page.check('input[name="visual_evidence_allowed"]');
    await page.fill('input[name="warning_threshold"]', '30');
    await page.fill('input[name="critical_threshold"]', '70');

    // Step 5: Add a question
    await page.click('button:has-text("Add Question")');
    await page.fill('input[name="prompt"]', 'What is the correct answer?');
    await page.selectOption('select[name="type"]', 'multiple_choice_single');
    await page.fill('input[name="option1"]', 'Option A');
    await page.fill('input[name="option2"]', 'Option B');
    await page.click('button:has-text("Mark Correct")');

    // Step 6: Publish the exam
    await page.click('button:has-text("Publish")');

    // Step 7: Verify redirect to exam detail page
    await page.waitForURL('/instructor/exams/*');

    // Step 8: Verify access code is visible
    const accessCode = await page.locator('[data-testid="access-code"]').textContent();
    expect(accessCode).toMatch(/^[0-9A-HJ-NPR-Z]{8}$/);

    // Step 9: Verify copy-to-clipboard button exists
    const copyButton = page.locator('[data-testid="copy-access-code-button"]');
    await expect(copyButton).toBeVisible();
  });

  test('should show error when publishing exam with no questions', async ({
    page,
  }) => {
    // Navigate to exam creation
    await page.goto('/instructor/exams/new');

    // Fill minimal required fields
    await page.fill('input[name="title"]', 'No Questions Exam');
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 1);
    await page.fill('input[name="starts_at"]', startDate.toISOString());
    await page.fill('input[name="duration_minutes"]', '60');

    // Try to publish without adding questions
    await page.click('button:has-text("Publish")');

    // Verify error message appears
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toContainText('at least one question');
  });
});
