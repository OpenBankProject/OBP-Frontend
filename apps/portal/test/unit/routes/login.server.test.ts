import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRedirect, isHttpError } from '@sveltejs/kit';
import { mockEnvironment } from '../../fixtures/oauth';
import { createMockRequestEvent, mockEnvVars, restoreAllMocks } from '../../helpers';

// The route depends on the provider factory singleton. Mock the whole module so
// `getFirstAvailableProvider` is a vi.fn() we control; this also avoids pulling
// in the real factory's `$env/dynamic/private` import at module load time.
vi.mock('$lib/oauth/providerFactory', () => ({
	oauth2ProviderFactory: {
		getFirstAvailableProvider: vi.fn()
	}
}));

import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import { GET } from '$lib/../routes/login/obp/+server';

describe('Login Server Routes', () => {
	beforeEach(() => {
		mockEnvVars(mockEnvironment);
		vi.clearAllMocks();
	});

	afterEach(() => {
		restoreAllMocks();
	});

	describe('/login/obp/+server.ts - GET', () => {
		it('redirects to the generic provider route when a provider is available', () => {
			vi.mocked(oauth2ProviderFactory.getFirstAvailableProvider).mockReturnValue('obp-oidc');

			const event = createMockRequestEvent();

			let thrown: unknown;
			try {
				GET(event);
				expect.fail('GET should have thrown a redirect');
			} catch (e) {
				thrown = e;
			}

			expect(isRedirect(thrown)).toBe(true);
			const redirect = thrown as { status: number; location: string };
			expect(redirect.status).toBe(302);
			expect(redirect.location).toBe('/login/obp-oidc');
		});

		it('redirects using whichever provider key the factory returns', () => {
			vi.mocked(oauth2ProviderFactory.getFirstAvailableProvider).mockReturnValue('keycloak');

			const event = createMockRequestEvent();

			let thrown: unknown;
			try {
				GET(event);
				expect.fail('GET should have thrown a redirect');
			} catch (e) {
				thrown = e;
			}

			expect(isRedirect(thrown)).toBe(true);
			const redirect = thrown as { status: number; location: string };
			expect(redirect.status).toBe(302);
			expect(redirect.location).toBe('/login/keycloak');
		});

		it('throws a 500 error when no provider is configured', () => {
			vi.mocked(oauth2ProviderFactory.getFirstAvailableProvider).mockReturnValue(null);

			const event = createMockRequestEvent();

			let thrown: unknown;
			try {
				GET(event);
				expect.fail('GET should have thrown an error');
			} catch (e) {
				thrown = e;
			}

			expect(isRedirect(thrown)).toBe(false);
			expect(isHttpError(thrown)).toBe(true);
			const httpError = thrown as { status: number; body: { message: string } };
			expect(httpError.status).toBe(500);
			expect(httpError.body.message).toBe('OAuth provider not configured');
		});

		it('consults the provider factory to decide where to redirect', () => {
			vi.mocked(oauth2ProviderFactory.getFirstAvailableProvider).mockReturnValue('google');

			const event = createMockRequestEvent();

			try {
				GET(event);
			} catch {
				// expected: GET always throws (redirect or error)
			}

			expect(oauth2ProviderFactory.getFirstAvailableProvider).toHaveBeenCalledTimes(1);
		});
	});
});
