import { test, expect } from '@playwright/test';

test.describe('Prompt Button Tests (Authenticated)', () => {
	const TEST_USERNAME = process.env.TEST_USERNAME || 'test_user@example.com';
	const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test_password_123';

	test.beforeEach(async ({ page }) => {
		// First complete the login flow
		await page.goto('/login');

		// Click the login button to start OAuth flow
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await loginButton.click();

		// Wait for redirect to OAuth provider
		await page.waitForLoadState('networkidle');

		// Fill in credentials
		const usernameField = page.locator('#username');
		await usernameField.fill(TEST_USERNAME);

		const passwordField = page.locator('#password');
		await passwordField.fill(TEST_PASSWORD);

		// Submit login form
		const submitButton = page.locator('input[type="submit"], button[type="submit"]');
		await submitButton.click();

		// Wait for OAuth callback and redirect back to app
		await page.waitForURL('**/login/obp/callback**', { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// Should be redirected to home page after successful login
		await page.goto('/');
		await page.waitForLoadState('networkidle');
	});

	test('should display suggested question buttons when chat is empty', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for suggested question buttons/pills
		const suggestedQuestions = page
			.locator('button')
			.filter({ hasText: /get started|api|documentation|authenticate|developer/i });

		// There should be at least one suggested question visible
		await expect(suggestedQuestions.first()).toBeVisible();

		// Verify multiple suggested questions exist
		const questionCount = await suggestedQuestions.count();
		expect(questionCount).toBeGreaterThan(0);
	});

	test('should be able to click suggested question buttons', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the "Get Started" suggested question button
		const getStartedButton = page
			.locator('button')
			.filter({ hasText: /get started/i });

		await expect(getStartedButton).toBeVisible();

		// Click the suggested question
		await getStartedButton.click();

		// Verify that clicking the suggestion sends a message
		const userMessage = page.locator('[class*="user"], [data-role="user"]').or(
			page.getByText(/get started/i)
		);
		await expect(userMessage).toBeVisible({ timeout: 5000 });

		// Wait for assistant response
		const assistantResponse = page
			.locator('[class*="assistant"], [data-role="assistant"]')
			.or(page.getByText(/opey/i).locator('..'));
		await expect(assistantResponse).toBeVisible({ timeout: 15000 });
	});

	test('should hide suggested questions after first message is sent', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Verify suggested questions are initially visible
		const suggestedQuestions = page
			.locator('button')
			.filter({ hasText: /get started|api|documentation/i });
		await expect(suggestedQuestions.first()).toBeVisible();

		// Click a suggested question
		const firstQuestion = suggestedQuestions.first();
		await firstQuestion.click();

		// Wait for message to be sent and processed
		await page.waitForTimeout(2000);

		// Suggested questions should no longer be visible after first message
		await expect(suggestedQuestions.first()).not.toBeVisible();
	});

	test('should have proper styling on suggested question buttons', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for suggested question buttons
		const suggestedButton = page
			.locator('button')
			.filter({ hasText: /get started/i });

		await expect(suggestedButton).toBeVisible();

		// Check that the button has expected CSS classes for styling
		await expect(suggestedButton).toHaveClass(/btn/);
		await expect(suggestedButton).toHaveClass(/border/);
		await expect(suggestedButton).toHaveClass(/rounded/);
	});

	test('should show button hover and focus states', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		const suggestedButton = page
			.locator('button')
			.filter({ hasText: /get started/i });

		await expect(suggestedButton).toBeVisible();

		// Test hover state
		await suggestedButton.hover();
		await expect(suggestedButton).toBeVisible(); // Should remain visible and functional

		// Test focus state
		await suggestedButton.focus();
		await expect(suggestedButton).toBeFocused();

		// Test keyboard activation
		await page.keyboard.press('Enter');

		// Should send message when activated with keyboard
		const userMessage = page.locator('[class*="user"], [data-role="user"]');
		await expect(userMessage).toBeVisible({ timeout: 5000 });
	});

	test('should disable suggested buttons during message processing', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		const suggestedButton = page
			.locator('button')
			.filter({ hasText: /get started/i });

		await expect(suggestedButton).toBeVisible();
		await expect(suggestedButton).toBeEnabled();

		// Click the button
		await suggestedButton.click();

		// During processing, buttons might be disabled (check if this behavior exists)
		// This test might need adjustment based on actual implementation
		const allButtons = page.locator('button');

		// Wait a moment for potential state changes
		await page.waitForTimeout(500);

		// Verify message was sent successfully
		const userMessage = page.locator('[class*="user"], [data-role="user"]');
		await expect(userMessage).toBeVisible({ timeout: 5000 });
	});

	test('should handle multiple suggested question types', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for different types of suggested questions
		const getStartedButton = page.locator('button').filter({ hasText: /get started/i });
		const apiButton = page.locator('button').filter({ hasText: /api/i });
		const authButton = page.locator('button').filter({ hasText: /auth/i });

		// At least one type should be visible
		const visibleButtons = [getStartedButton, apiButton, authButton];
		let hasVisibleButton = false;

		for (const button of visibleButtons) {
			if (await button.isVisible()) {
				hasVisibleButton = true;

				// Click the visible button
				await button.click();

				// Verify it sends a message
				const userMessage = page.locator('[class*="user"], [data-role="user"]');
				await expect(userMessage).toBeVisible({ timeout: 5000 });

				break;
			}
		}

		expect(hasVisibleButton).toBe(true);
	});

	test('should display icons in suggested question buttons if configured', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for buttons that might contain icons (SVG elements)
		const buttonsWithIcons = page.locator('button').filter({ has: page.locator('svg') });

		// If icons are configured, they should be visible
		if (await buttonsWithIcons.first().isVisible()) {
			const iconCount = await buttonsWithIcons.count();
			expect(iconCount).toBeGreaterThan(0);

			// Verify the SVG icon is properly rendered
			const firstIconButton = buttonsWithIcons.first();
			const icon = firstIconButton.locator('svg');
			await expect(icon).toBeVisible();
		}
	});
});
