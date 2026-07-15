import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoginPage from '$lib/../routes/login/+page.svelte';

// Note: `$app/navigation` (goto, invalidateAll) is globally mocked in test/setup.ts,
// so onMount's setInterval(invalidateAll) and goto usage do not blow up here.

// Helper to build the PageData prop for the login page. Only the provider/error
// fields the component reads are supplied; cast to satisfy the fuller PageData type.
function makeData(overrides = {}) {
	return {
		availableProviders: [],
		unavailableProviders: [],
		...overrides
	} as never;
}

describe('Login Page Component', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('should render the Login title heading', () => {
		render(LoginPage, { props: { data: makeData() } });

		const title = screen.getByRole('heading', { level: 1, name: /login/i });
		expect(title).toBeInTheDocument();
		expect(title).toHaveClass('h2');
	});

	it('should render a provider button/link for each available provider', () => {
		render(LoginPage, {
			props: {
				data: makeData({
					availableProviders: [{ provider: 'obp-oidc' }, { provider: 'keycloak' }]
				})
			}
		});

		// obp-oidc provider
		const oidcButton = screen.getByTestId('provider-obp-oidc');
		expect(oidcButton).toBeInTheDocument();
		const oidcLink = oidcButton.querySelector('a');
		expect(oidcLink).toHaveAttribute('href', '/login/obp-oidc');
		expect(oidcLink).toHaveTextContent('OBP OpenID Connect');

		// keycloak provider
		const keycloakButton = screen.getByTestId('provider-keycloak');
		expect(keycloakButton).toBeInTheDocument();
		const keycloakLink = keycloakButton.querySelector('a');
		expect(keycloakLink).toHaveAttribute('href', '/login/keycloak');
		expect(keycloakLink).toHaveTextContent('Keycloak');
	});

	it('should capitalize unknown provider names', () => {
		render(LoginPage, {
			props: { data: makeData({ availableProviders: [{ provider: 'github' }] }) }
		});

		const button = screen.getByTestId('provider-github');
		const link = button.querySelector('a');
		expect(link).toHaveAttribute('href', '/login/github');
		expect(link).toHaveTextContent('Github');
	});

	it('should show a message when there are no available providers', () => {
		render(LoginPage, { props: { data: makeData({ availableProviders: [] }) } });

		expect(
			screen.getByText(/no authentication providers available/i)
		).toBeInTheDocument();
		expect(screen.queryByTestId('provider-obp-oidc')).not.toBeInTheDocument();
	});

	it('should render the error block when an errorMessage is provided', () => {
		render(LoginPage, {
			props: { data: makeData({ errorMessage: 'Something went wrong' }) }
		});

		const errorBlock = screen.getByTestId('login-error');
		expect(errorBlock).toBeInTheDocument();
		expect(errorBlock).toHaveTextContent('Something went wrong');
	});

	it('should not render the error block when there is no errorMessage', () => {
		render(LoginPage, { props: { data: makeData() } });

		expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
	});

	it('should render unavailable providers with their error in the unavailable section', () => {
		render(LoginPage, {
			props: {
				data: makeData({
					availableProviders: [{ provider: 'obp-oidc' }],
					unavailableProviders: [{ provider: 'keycloak', error: 'Connection refused' }]
				})
			}
		});

		expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
		expect(screen.getByText('Keycloak')).toBeInTheDocument();
		expect(screen.getByText('Connection refused')).toBeInTheDocument();
	});

	it('should render unavailable providers even when there are no available providers', () => {
		render(LoginPage, {
			props: {
				data: makeData({
					availableProviders: [],
					unavailableProviders: [{ provider: 'obp-oidc', error: 'Timed out' }]
				})
			}
		});

		expect(
			screen.getByText(/no authentication providers available/i)
		).toBeInTheDocument();
		expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
		expect(screen.getByText('OBP OpenID Connect')).toBeInTheDocument();
		expect(screen.getByText('Timed out')).toBeInTheDocument();
	});
});
