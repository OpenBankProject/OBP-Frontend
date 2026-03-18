import { test, expect } from '@playwright/test';

test.describe('Login Button Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the login page before each test
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
	});

	test('should display login button on login page', async ({ page }) => {
		// Check if the login button exists and is visible
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible({ timeout: 10000 });
	});

	test('should have correct login button styling', async ({ page }) => {
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible();

		// Check if button has the expected CSS classes
		await expect(loginButton).toHaveClass(/btn/);
		await expect(loginButton).toHaveClass(/preset-filled-primary-500/);
		await expect(loginButton).toHaveClass(/mx-auto/);
		await expect(loginButton).toHaveClass(/my-4/);
		await expect(loginButton).toHaveClass(/block/);
	});

	test('should navigate to OAuth login when clicked', async ({ page }) => {
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible();

		// Click the login button and wait for navigation
		await Promise.all([page.waitForURL('**/auth**', { timeout: 15000 }), loginButton.click()]);

		// Check if we're redirected to the OAuth provider (external URL)
		expect(page.url()).toContain('openbankproject.com');
		expect(page.url()).toContain('protocol/openid-connect/auth');
	});

	test('should be accessible via keyboard navigation', async ({ page }) => {
		const loginLink = page.getByRole('link', { name: /login with open bank project/i });
		await expect(loginLink).toBeVisible();

		// Focus the login link directly
		await loginLink.focus();
		await expect(loginLink).toBeFocused();

		// Press Enter to activate the link and wait for navigation
		await Promise.all([
			page.waitForURL('**/auth**', { timeout: 15000 }),
			page.keyboard.press('Enter')
		]);

		// Verify navigation occurred to OAuth provider
		expect(page.url()).toContain('openbankproject.com');
		expect(page.url()).toContain('protocol/openid-connect/auth');
	});

	test('should have proper button text content', async ({ page }) => {
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });

		// Check the exact text content
		await expect(loginButton).toContainText('Login with Open Bank Project');
	});

	test('should be responsive on different screen sizes', async ({ page }) => {
		// Test on mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		const loginButtonMobile = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButtonMobile).toBeVisible();
		await expect(loginButtonMobile).toHaveClass(/w-full/);

		// Test on desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });
		const loginButtonDesktop = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButtonDesktop).toBeVisible();
		await expect(loginButtonDesktop).toHaveClass(/sm:w-1\/2/);
	});

	test('should have correct link href attribute', async ({ page }) => {
		const loginLink = page.getByRole('link', { name: /login with open bank project/i });
		await expect(loginLink).toHaveAttribute('href', '/login/obp');
	});

	test('should display login page title', async ({ page }) => {
		// Check if the login page has the correct title
		const title = page.getByRole('heading', { name: /login/i });
		await expect(title).toBeVisible();
		await expect(title).toHaveClass(/h2/);
		await expect(title).toHaveClass(/text-center/);
	});

	test('should have proper page layout structure', async ({ page }) => {
		// Check if the login form container has the expected styling
		const container = page.locator('div.rounded-xl');
		await expect(container).toBeVisible();
		await expect(container).toHaveClass(/mx-auto/);
		await expect(container).toHaveClass(/bg-white\/10/);
		await expect(container).toHaveClass(/backdrop-blur-xs/);
	});

	test('should handle login button interaction states', async ({ page }) => {
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });

		// Check hover state (if CSS supports it)
		await loginButton.hover();
		await expect(loginButton).toBeVisible();

		// Check if button remains functional after hover
		await loginButton.click();
		await page.waitForLoadState('networkidle');
		expect(page.url()).toContain('openbankproject.com');
		expect(page.url()).toContain('protocol/openid-connect/auth');
	});
});

test.describe('Complete Login Flow Tests', () => {
	const TEST_USERNAME = process.env.TEST_USERNAME || 'test_user@example.com';
	const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test_password_123';

	test('should complete full OAuth login flow with credentials', async ({ page }) => {
		// Navigate to login page
		await page.goto('/login');
		await page.waitForLoadState('networkidle');

		// Click the login button to start OAuth flow
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible();

		await Promise.all([page.waitForURL('**/auth**', { timeout: 15000 }), loginButton.click()]);

		expect(page.url()).toContain('openbankproject.com');

		// Fill in username
		const usernameField = page.locator('#username');
		await expect(usernameField).toBeVisible({ timeout: 10000 });
		await usernameField.fill(TEST_USERNAME);

		// Fill in password
		const passwordField = page.locator('#password');
		await expect(passwordField).toBeVisible();
		await passwordField.fill(TEST_PASSWORD);

		// Submit login form and wait for callback
		const submitButton = page.locator('input[type="submit"], button[type="submit"]');
		await Promise.all([
			page.waitForURL('**/login/obp/callback**', { timeout: 15000 }),
			submitButton.click()
		]);

		// Wait for final redirect to main app
		await page.waitForLoadState('networkidle');

		// Verify successful login - check for logout button or user info
		const logoutButton = page.getByRole('button', { name: /logout/i });
		await expect(logoutButton).toBeVisible({ timeout: 10000 });
	});

	test('should handle invalid credentials gracefully', async ({ page }) => {
		// Navigate to login page
		await page.goto('/login');
		await page.waitForLoadState('networkidle');

		// Click the login button to start OAuth flow
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible();

		await Promise.all([page.waitForURL('**/auth**', { timeout: 15000 }), loginButton.click()]);

		expect(page.url()).toContain('openbankproject.com');

		// Fill in invalid credentials
		const usernameField = page.locator('#username');
		await expect(usernameField).toBeVisible({ timeout: 10000 });
		await usernameField.fill('invalid@example.com');

		const passwordField = page.locator('#password');
		await expect(passwordField).toBeVisible();
		await passwordField.fill('wrongpassword');

		// Submit login form
		const submitButton = page.locator('input[type="submit"], button[type="submit"]');
		await submitButton.click();

		// Wait for error message or page to stabilize
		await page.waitForTimeout(3000);

		// Check for error message (adjust selector based on OAuth provider)
		const errorMessage = page.locator('#input-error, .error, [role="alert"]');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
		expect(page.url()).toContain('openbankproject.com'); // Still on OAuth provider
	});

	test('should handle OAuth cancellation', async ({ page }) => {
		// Navigate to login page
		await page.goto('/login');
		await page.waitForLoadState('networkidle');

		// Click the login button to start OAuth flow
		const loginButton = page.getByRole('button', { name: /login with open bank project/i });
		await expect(loginButton).toBeVisible();

		await Promise.all([page.waitForURL('**/auth**', { timeout: 15000 }), loginButton.click()]);

		expect(page.url()).toContain('openbankproject.com');

		// Look for and click cancel/back button if available
		const cancelButton = page.locator(
			'a:has-text("Cancel"), button:has-text("Cancel"), a:has-text("Back")'
		);

		if (await cancelButton.isVisible({ timeout: 5000 })) {
			await Promise.all([page.waitForURL('**/login**', { timeout: 10000 }), cancelButton.click()]);

			// Should be back on login page or show appropriate error
			expect(page.url()).toContain('/login');
		}
	});
});
