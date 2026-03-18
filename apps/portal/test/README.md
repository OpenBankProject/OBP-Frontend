# OBP Portal Test Suite

This directory contains comprehensive tests for the OBP Portal application, focusing on OAuth authentication, login functionality, and related components.

## Test Structure

```
test/
├── fixtures/           # Test data and mock objects
│   └── oauth.ts        # OAuth-related test fixtures
├── helpers/            # Test utility functions
│   └── index.ts        # Common test helpers and mocks
├── unit/               # Unit tests
│   ├── oauth/          # OAuth functionality tests
│   │   ├── client.test.ts    # OAuth2ClientWithConfig tests
│   │   └── session.test.ts   # OAuth session utilities tests
│   └── routes/         # Route handler tests
│       ├── login.server.test.ts  # Login server route tests
│       └── login.svelte.test.ts  # Login page component tests
├── integration/        # Integration tests
│   └── oauth-flow.test.ts    # Complete OAuth flow tests
├── setup.ts            # Global test setup and mocks
└── README.md           # This file
```

## Test Categories

### Unit Tests

**OAuth Client Tests** (`unit/oauth/client.test.ts`)
- Tests for `OAuth2ClientWithConfig` class
- OIDC configuration initialization
- Access token expiration checking
- Authorization URL creation
- Error handling and logging

**OAuth Session Tests** (`unit/oauth/session.test.ts`)
- Session-based token refresh functionality
- Session data management
- Error handling for token refresh failures
- Edge cases and validation

**Login Route Tests** (`unit/routes/login.server.test.ts`)
- Login initiation endpoint (`/login/obp`)
- OAuth callback handling (`/login/obp/callback`)
- State validation and CSRF protection
- User data fetching and session creation
- Error scenarios and edge cases

**Login Component Tests** (`unit/routes/login.svelte.test.ts`)
- Svelte component rendering
- UI accessibility and styling
- User interaction handling
- Responsive design validation

### Integration Tests

**OAuth Flow Tests** (`integration/oauth-flow.test.ts`)
- Complete OAuth 2.0 flow from start to finish
- Token lifecycle management
- Session persistence across requests
- Error recovery scenarios
- Configuration validation

## Test Fixtures

**OAuth Fixtures** (`fixtures/oauth.ts`)
- Mock OIDC configuration
- Sample JWT tokens (valid and expired)
- Mock user data
- Session data templates
- Environment variables for testing

## Test Helpers

**Common Helpers** (`helpers/index.ts`)
- Mock fetch function creator
- Form data utilities
- URL and request mocking
- Session and cookie mocking
- JWT token creation utilities
- Environment variable mocking

## Running Tests

### All Tests
```bash
npm run test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test -- test/integration
```

### Watch Mode
```bash
npm run test:unit -- --watch
```

### Coverage Report
```bash
npm run test -- --coverage
```

## Test Configuration

The test suite uses:
- **Vitest** for test running and assertions
- **Testing Library** for component testing
- **JSDOM** for browser environment simulation
- **Custom mocks** for SvelteKit modules and external dependencies

### Environment Setup

Tests run with:
- Mocked SvelteKit stores and navigation
- Mocked Arctic OAuth library
- Mocked fetch API
- Mocked browser APIs (crypto, matchMedia, etc.)

## Writing New Tests

### Test File Naming
- Unit tests: `*.test.ts` or `*.spec.ts`
- Component tests: `*.svelte.test.ts`
- Integration tests: Place in `integration/` directory

### Common Patterns

#### Testing OAuth Functions
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockOIDCConfiguration } from '../fixtures/oauth';
import { createMockFetch } from '../helpers';

describe('OAuth Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful OAuth flow', async () => {
    const mockFetch = createMockFetch([
      { url: '/.well-known', response: mockOIDCConfiguration }
    ]);
    global.fetch = mockFetch;
    
    // Test implementation
  });
});
```

#### Testing Svelte Components
```typescript
import { render, screen } from '@testing-library/svelte';
import Component from '$lib/Component.svelte';

describe('Component', () => {
  it('should render correctly', () => {
    render(Component);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

#### Testing Server Routes
```typescript
import { createMockRequestEvent } from '../helpers';
import { GET } from '$lib/../routes/api/endpoint/+server';

describe('API Route', () => {
  it('should handle GET request', async () => {
    const event = createMockRequestEvent();
    const response = await GET(event);
    
    expect(response.status).toBe(200);
  });
});
```

## Mock Data Guidelines

- Use realistic data that matches production API responses
- Include both success and error scenarios
- Test edge cases (missing fields, invalid formats, etc.)
- Keep fixtures DRY and reusable across tests

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Mocking**: Mock external dependencies to control test environment
3. **Coverage**: Aim for high test coverage, especially for critical OAuth flows
4. **Readability**: Use descriptive test names and clear assertions
5. **Performance**: Keep tests fast by avoiding unnecessary async operations
6. **Maintenance**: Update tests when changing implementation

## Debugging Tests

### Common Issues

1. **Unmocked fetch calls**: Check console for warnings about unmocked URLs
2. **SvelteKit module errors**: Ensure all `$app/*` and `$lib/*` imports are mocked
3. **Environment variables**: Use `mockEnvVars()` helper for consistent env setup
4. **Async timing**: Use `await` for all async operations in tests

### Debug Mode
```bash
npm run test -- --reporter=verbose
```

### Test-specific debugging
```bash
npm run test -- --reporter=verbose test/unit/oauth/client.test.ts
```

## Contributing

When adding new tests:
1. Follow the existing directory structure
2. Use appropriate fixtures and helpers
3. Include both success and failure scenarios
4. Add JSDoc comments for complex test logic
5. Update this README if adding new test categories