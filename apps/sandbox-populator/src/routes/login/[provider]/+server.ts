import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ProviderLogin');
import { generateState } from 'arctic';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export function GET(event: RequestEvent) {
	const { provider } = event.params;

	if (!provider) {
		logger.error('No provider specified in URL');
		throw error(400, 'Provider not specified');
	}

	// Check if the requested provider is available
	const oauthClient = oauth2ProviderFactory.getClient(provider);
	if (!oauthClient) {
		logger.error(
			`OAuth client for provider "${provider}" not found. Available providers: ${Array.from(oauth2ProviderFactory.getAllClients().keys()).join(', ')}`
		);
		throw error(404, 'OAuth provider not found');
	}

	const state = generateState();
	// Encode provider in the state - format "state:provider"
	const encodedState = `${state}:${provider}`;

	const scopes = ['openid', 'email', 'profile'];

	logger.debug(`OAuth client found for provider: ${provider}`);
	logger.debug(`OIDC Config present: ${!!oauthClient.OIDCConfig}`);
	if (oauthClient.OIDCConfig) {
		logger.debug(`Authorization endpoint: ${oauthClient.OIDCConfig.authorization_endpoint}`);
		logger.debug(`Token endpoint: ${oauthClient.OIDCConfig.token_endpoint}`);
	} else {
		logger.info(
			'OIDC Config not present on OAuth client. Retry to get config form OIDC well-known endpoint.'
		);
	}

	const auth_endpoint = oauthClient.OIDCConfig?.authorization_endpoint;
	if (!auth_endpoint) {
		logger.error('Authorization endpoint not found in OIDC configuration.');
		logger.error(`Full OIDC config: ${JSON.stringify(oauthClient.OIDCConfig, null, 2)}`);
		throw error(500, 'OAuth configuration error');
	}

	try {
		const url = oauthClient.createAuthorizationURL(auth_endpoint, encodedState, scopes);

		event.cookies.set('obp_oauth_state', encodedState, {
			httpOnly: true,
			maxAge: 60 * 10,
			secure: import.meta.env.PROD,
			path: '/',
			sameSite: 'lax'
		});

		return new Response(null, {
			status: 302,
			headers: {
				Location: url.toString()
			}
		});
	} catch (err) {
		logger.error(`Error during ${provider} OAuth login:`, err);
		throw error(500, 'Internal Server Error');
	}
}
