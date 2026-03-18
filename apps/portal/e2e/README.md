# End-to-End Testing Setup

This directory contains comprehensive end-to-end tests for the OBP Portal application.

## Quick Start

To run the tests quickly, **navigate to the project root directory** (`OBP-Portal/`) first:

```bash
# Navigate to project root
cd OBP-Portal

# Run Playwright tests (recommended)
npm run test:e2e

# Run Playwright tests with visual interface (for debugging)
npx playwright test --ui

# Run Playwright tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file with visual interface
npx playwright test e2e/login-button.test.ts --ui

# Or run Selenium tests (alternative)
npm install --save-dev selenium-webdriver chai mocha chromedriver
npx mocha e2e/selenium-login-button.test.js --timeout 30000
```

## Test Frameworks

### Playwright (Recommended)

The project is already configured with Playwright for E2E testing. These tests are located in:

- `login-button.test.ts` - Comprehensive login button functionality tests

To run Playwright tests:

```bash
npm run test:e2e
```

### Selenium WebDriver (Alternative)

For those who prefer traditional Selenium WebDriver, we also provide:

- `selenium-login-button.test.js` - Same test coverage using Selenium

#### Selenium Setup

1. Install Selenium dependencies:

```bash
npm install --save-dev selenium-webdriver chai mocha chromedriver
```

2. Make sure you have Chrome browser installed on your system.

3. Run Selenium tests:

```bash
# Run with Mocha
npx mocha e2e/selenium-login-button.test.js --timeout 30000

# Or add to package.json scripts:
# "test:selenium": "mocha e2e/selenium-login-button.test.js --timeout 30000"
```

## Test Coverage

Both test suites cover the following login button functionality:

### Core Functionality

- ✅ Button visibility and rendering
- ✅ Correct CSS styling and classes
- ✅ Navigation to OAuth login endpoint (`/login/obp`)
- ✅ Proper button text content
- ✅ Link href attribute validation

### Accessibility

- ✅ Keyboard navigation (Tab + Enter)
- ✅ Focus management
- ✅ Screen reader compatibility

### Responsive Design

- ✅ Mobile viewport testing (375x667)
- ✅ Desktop viewport testing (1920x1080)
- ✅ Responsive CSS classes (`w-full`, `sm:w-1/2`)

### User Experience

- ✅ Hover interactions
- ✅ Button interaction states
- ✅ Page layout structure validation
- ✅ Load performance testing

### Page Structure

- ✅ Login page title display
- ✅ Container styling and backdrop effects
- ✅ Layout responsiveness

## Configuration

### Playwright Configuration

The Playwright configuration is in `playwright.config.ts` at the project root:

- Web server runs on port 4173
- Tests build and preview the application before running

### Selenium Configuration

The Selenium tests are configured to:

- Use Chrome WebDriver
- Connect to `http://localhost:4173` (adjust BASE_URL as needed)
- 30-second timeout for test operations
- Automatic driver cleanup after each test

## Running Tests

### Development Server

Before running tests, make sure your development server is running:

```bash
# For Playwright (automatic)
npm run test:e2e

# For Selenium (manual server start)
npm run build && npm run preview
# Then in another terminal:
npx mocha e2e/selenium-login-button.test.js --timeout 30000
```

### CI/CD Integration

Both test suites can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests (Playwright)
  run: npm run test:e2e

- name: Run E2E Tests (Selenium)
  run: |
    npm run build
    npm run preview &
    sleep 5
    npx mocha e2e/selenium-login-button.test.js --timeout 30000
```

## Browser Support

### Playwright

- Chromium, Firefox, Safari (WebKit)
- Mobile browsers simulation
- Configurable in `playwright.config.ts`

### Selenium

- Chrome (default configuration)
- Can be extended for Firefox, Safari, Edge
- Requires appropriate WebDriver binaries

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 4173 is available or update BASE_URL
2. **ChromeDriver version**: Make sure ChromeDriver matches your Chrome version
3. **Timeouts**: Increase timeout values for slower environments
4. **Element not found**: Wait for elements to load before interacting

### Debug Mode

For Playwright:

```bash
# Debug mode with step-by-step execution
npx playwright test --debug

# Visual interface for test development and debugging
npx playwright test --ui

# Run tests in headed mode (see the browser)
npx playwright test --headed

# Run with slow motion to see actions clearly
npx playwright test --headed --slowMo=1000

# Record a test (generates code by recording your actions)
npx playwright codegen localhost:4173

# Debug specific test file
npx playwright test e2e/login-button.test.ts --debug

# Run tests and keep browser open after completion
npx playwright test --headed --debug
```

For Selenium:

```bash
# Add --inspect flag to Node.js
node --inspect node_modules/.bin/mocha e2e/selenium-login-button.test.js --timeout 30000
```

## Adding New Tests

When adding new E2E tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include proper setup/teardown
4. Test both happy path and edge cases
5. Consider accessibility and responsive design
6. Add appropriate waits for async operations

## Dependencies

### Playwright (Already Installed)

- `@playwright/test`: ^1.49.1

### Selenium (Optional)

- `selenium-webdriver`: Latest
- `chai`: Latest
- `mocha`: Latest
- `chromedriver`: Latest

Run `npm install --save-dev selenium-webdriver chai mocha chromedriver` to add Selenium support.

## Visual Debugging with Playwright

If you're experiencing issues like screen flickering or multiple login panels, use these debugging approaches:

### Playwright UI Mode (Recommended)

```bash
npx playwright test --ui
```

This opens a visual interface where you can:

- See tests running in real-time
- Step through each action
- Inspect element selectors
- View network requests
- Debug timing issues

### Headed Mode

```bash
npx playwright test --headed
```

Runs tests with browser visible so you can see what's happening.

### Slow Motion Mode

```bash
npx playwright test --headed --slowMo=1000
```

Adds delays between actions to see each step clearly.

### Debugging Tips for Flickering Issues:

1. Use `--ui` mode to step through tests slowly
2. Check for unnecessary `page.goto()` calls
3. Verify `waitForLoadState('networkidle')` is used appropriately
4. Look for race conditions in element selection
5. Consider adding `page.waitForTimeout()` for problematic sections

## Troubleshooting Common Issues

### OAuth Token Refresh Failures

If you see errors like:

```
OAuth2RequestError: OAuth request error: invalid_grant
code: 'invalid_grant',
description: 'Token is not active'
```

**What's happening:**

- User's refresh token has expired or become invalid
- System cannot automatically renew the session
- User needs to log in again

**Common causes:**

1. **Refresh token expiration** - OAuth providers set token lifetimes (e.g., 30 days)
2. **Token revocation** - User logged out from another session
3. **Provider security policy** - Tokens invalidated after inactivity
4. **Configuration mismatch** - OAuth client settings incorrect

**Solutions:**

1. **For development**: Check your `.env.test` OAuth configuration
2. **For testing**: Use fresh credentials in your test environment
3. **For production**: Implement proper error handling to redirect users to login
4. **Session management**: Consider shorter session timeouts to prevent this

**Test environment fixes:**

```bash
# Clear any cached sessions
rm -rf .svelte-kit/output/server/chunks
npm run build

# Use fresh test credentials
cp .env.test.example .env.test
# Edit .env.test with current valid credentials
```

### Common Flickering Fixes Applied:

**Better Wait Strategies:**

```bash
# Always wait after navigation in beforeEach
await page.goto('/login');
await page.waitForLoadState('networkidle');
```

**Use Promise.all for Navigation:**

```bash
# Wait for navigation simultaneously with clicking
await Promise.all([
    page.waitForURL('**/auth**', { timeout: 15000 }),
    loginButton.click()
]);
```

**Specific URL Patterns Instead of Generic Waits:**

```bash
# More reliable than waitForLoadState
await page.waitForURL('**/login/obp/callback**', { timeout: 15000 })
```

**Visibility Checks Before Actions:**

```bash
# Always verify elements exist before interacting
await expect(loginButton).toBeVisible();
await loginButton.click();
```

**Increased Timeouts for Slow Operations:**

```bash
# Prevent premature failures
await expect(loginButton).toBeVisible({ timeout: 10000 });
```
