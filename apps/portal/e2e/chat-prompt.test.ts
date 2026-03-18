import { test, expect } from '@playwright/test';

test.describe('Chat Prompt Tests (Authenticated)', () => {
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

	test('should display chat interface on home page after login', async ({ page }) => {
		// Check if the OpeyChat component is visible
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Check for welcome message
		const welcomeHeading = page.getByRole('heading', { name: /welcome/i });
		await expect(welcomeHeading).toBeVisible();

		// Check for "How can I help?" text
		const helpText = page.getByText(/how can i help/i);
		await expect(helpText).toBeVisible();
	});

	test('should be able to enter and send the rostock bank prompt', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the input field - it should be a textarea or input
		const messageInput = page
			.locator('input[type="text"], textarea')
			.filter({ hasText: '' })
			.first();
		await expect(messageInput).toBeVisible();

		// Enter the specific prompt about creating a bank with "rostock"
		const prompt =
			'please create a bank using "rostock" as the basis for the bank code and bank name etc.';
		await messageInput.fill(prompt);

		// Find and click the send button
		const sendButton = page
			.locator('button')
			.filter({ hasText: /send/i })
			.or(page.locator('button[type="submit"]'))
			.or(page.locator('button').filter({ has: page.locator('svg') }))
			.first();

		await expect(sendButton).toBeVisible();
		await sendButton.click();

		// Verify the message was sent by checking if it appears in the chat
		const userMessage = page.getByText(prompt);
		await expect(userMessage).toBeVisible({ timeout: 5000 });

		// Wait for and verify that there's a response from the assistant
		const assistantResponse = page
			.locator('[class*="assistant"], [data-role="assistant"]')
			.or(page.getByText(/opey/i).locator('..'));
		await expect(assistantResponse).toBeVisible({ timeout: 15000 });
	});

	test('should handle keyboard shortcut for sending message', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the input field
		const messageInput = page
			.locator('input[type="text"], textarea')
			.filter({ hasText: '' })
			.first();
		await expect(messageInput).toBeVisible();

		// Enter the rostock prompt
		const prompt =
			'please create a bank using "rostock" as the basis for the bank code and bank name etc.';
		await messageInput.fill(prompt);

		// Send message using Enter key
		await messageInput.press('Enter');

		// Verify the message was sent
		const userMessage = page.getByText(prompt);
		await expect(userMessage).toBeVisible({ timeout: 5000 });

		// Wait for assistant response
		const assistantResponse = page
			.locator('[class*="assistant"], [data-role="assistant"]')
			.or(page.getByText(/opey/i).locator('..'));
		await expect(assistantResponse).toBeVisible({ timeout: 15000 });
	});

	test('should clear input after sending message', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the input field
		const messageInput = page
			.locator('input[type="text"], textarea')
			.filter({ hasText: '' })
			.first();
		await expect(messageInput).toBeVisible();

		// Enter a message
		const testMessage = 'test message for input clearing';
		await messageInput.fill(testMessage);

		// Verify message is in input
		await expect(messageInput).toHaveValue(testMessage);

		// Send the message
		await messageInput.press('Enter');

		// Verify input is cleared after sending
		await expect(messageInput).toHaveValue('');
	});

	test('should handle empty message gracefully', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the input field
		const messageInput = page
			.locator('input[type="text"], textarea')
			.filter({ hasText: '' })
			.first();
		await expect(messageInput).toBeVisible();

		// Try to send an empty message
		await messageInput.fill('');
		await messageInput.press('Enter');

		// The send button should be disabled or no message should be sent
		const sendButton = page
			.locator('button')
			.filter({ hasText: /send/i })
			.or(page.locator('button[type="submit"]'))
			.first();

		// Button should be disabled when input is empty
		if (await sendButton.isVisible()) {
			await expect(sendButton).toBeDisabled();
		}
	});

	test('should handle whitespace-only message gracefully', async ({ page }) => {
		// Wait for chat interface to be ready
		const chatContainer = page.locator('.max-w-4xl.max-h-\\[80vh\\].rounded-2xl');
		await expect(chatContainer).toBeVisible();

		// Look for the input field
		const messageInput = page
			.locator('input[type="text"], textarea')
			.filter({ hasText: '' })
			.first();
		await expect(messageInput).toBeVisible();

		// Try to send a whitespace-only message
		await messageInput.fill('   ');
		await messageInput.press('Enter');

		// The message should not be sent (input should remain as whitespace or be cleared)
		const messagesAfter = page.locator('[class*="user"], [data-role="user"]');
		const messageCount = await messagesAfter.count();
		expect(messageCount).toBe(0);
	});
});
