import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ConsentScreen');
import type { RequestEvent, Actions } from '@sveltejs/kit';

export async function load(event: RequestEvent) {
	const consentChallenge = event.url.searchParams.get('consent_challenge');

	const username = event.locals.session.data.user?.username || 'User';

	if (!consentChallenge) {
		return {
			loadError: 'Missing required parameter: consent_challenge.',
			consentChallenge: '',
			username,
			applicationName: '',
			requestedScopes: [] as string[],
			};
	}

	// TODO: Integrate with OIDC provider's consent mechanism.
	// The consent challenge flow is provider-specific (not part of the OIDC standard):
	// - Hydra: GET /oauth2/auth/requests/consent?consent_challenge=...
	// - Keycloak: Consent is typically handled within Keycloak's own UI
	// - OBP-OIDC: Needs custom consent introspection endpoint
	// The provider's consent API should return: application name, requested scopes, client info.
	// Access the OIDC config via: oauth2ProviderFactory.getClient(provider)?.OIDCConfig

	return {
		consentChallenge,
		username,
		// Placeholder values - replace with actual data from OIDC provider's consent API
		applicationName: 'Application',
		requestedScopes: ['openid', 'profile'],
	};
}

export const actions = {
	allow: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentChallenge = formData.get('consentChallenge') as string;
		const rememberConsent = formData.get('rememberConsent') === 'on';

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		// TODO: Call the OIDC provider's consent accept API with the challenge.
		// The response should include a redirect_to URL to send the user back to the OAuth flow.
		// For Hydra: PUT /oauth2/auth/requests/consent/accept
		// For Keycloak: POST {realm}/protocol/openid-connect/auth/consent
		// For OBP-OIDC: Needs custom consent accept endpoint
		// After accepting, redirect(303, response.redirect_to)
		logger.info('Consent allowed for challenge:', consentChallenge, 'remember:', rememberConsent);

		return {
			success: true,
			message: 'Consent granted successfully.'
		};
	},

	deny: async ({ request }) => {
		const formData = await request.formData();
		const consentChallenge = formData.get('consentChallenge') as string;

		// TODO: Call the OIDC provider's consent reject API with the challenge.
		// For Hydra: PUT /oauth2/auth/requests/consent/reject
		// For Keycloak: POST {realm}/protocol/openid-connect/auth/consent (with deny)
		// For OBP-OIDC: Needs custom consent reject endpoint
		// After rejecting, redirect(303, response.redirect_to)
		logger.info('Consent denied for challenge:', consentChallenge);

		return {
			success: true,
			message: 'Consent denied.'
		};
	}
} satisfies Actions;
