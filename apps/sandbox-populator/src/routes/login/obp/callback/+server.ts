import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OBPLoginCallback');
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import type { OAuth2Tokens } from 'arctic';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

export async function GET(event: RequestEvent): Promise<Response> {
	// Check for OAuth error responses first
	const oauthError = event.url.searchParams.get('error');
	const errorDescription = event.url.searchParams.get('error_description');

	if (oauthError) {
		logger.warn(`OAuth error received: ${oauthError}`, errorDescription);

		event.cookies.delete('obp_oauth_state', {
			path: '/'
		});

		let userMessage = 'Authentication failed. Please try again.';

		if (oauthError === 'invalid_grant') {
			if (errorDescription?.toLowerCase().includes('password')) {
				userMessage = 'Invalid username or password. Please check your credentials and try again.';
			} else if (errorDescription?.toLowerCase().includes('token')) {
				userMessage = 'Session expired. Please try logging in again.';
			} else {
				userMessage = errorDescription || 'Invalid credentials. Please try again.';
			}
		} else if (oauthError === 'access_denied') {
			userMessage =
				'Access was denied. Please contact your administrator if you believe this is an error.';
		} else if (errorDescription) {
			userMessage = errorDescription.replace(/\+/g, ' ');
		}

		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent(userMessage)}`
			}
		});
	}

	const storedState = event.cookies.get('obp_oauth_state');
	const code = event.url.searchParams.get('code');
	const recievedState = event.url.searchParams.get('state');

	if (storedState === null) {
		logger.error('No stored state cookie found');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Session expired. Please try logging in again.')}`
			}
		});
	}

	if (code === null) {
		logger.error('No authorization code received');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('No authorization code received. Please try again.')}`
			}
		});
	}

	if (recievedState === null) {
		logger.error('No state parameter received');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Invalid request. Please try again.')}`
			}
		});
	}

	if (storedState !== recievedState) {
		logger.warn('State mismatch:', { stored: storedState, received: recievedState });
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Security validation failed. Please try logging in again.')}`
			}
		});
	}

	const [actualState, provider] = storedState.split(':');
	logger.debug('Received state:', recievedState);
	if (!provider) {
		logger.error('Provider not found in state');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Invalid authentication state. Please try again.')}`
			}
		});
	}

	const oauthClient = oauth2ProviderFactory.getClient(provider);
	if (!oauthClient) {
		logger.error(`OAuth client for provider "${provider}" not found.`);
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Authentication provider not available. Please contact your administrator.')}`
			}
		});
	}

	logger.debug(`Processing callback for provider: ${provider}`);

	const token_endpoint = oauthClient.OIDCConfig?.token_endpoint;
	if (!token_endpoint) {
		logger.error('Token endpoint not found in OIDC configuration for provider:', provider);
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Authentication service misconfigured. Please contact your administrator.')}`
			}
		});
	}

	let tokens: OAuth2Tokens;
	try {
		tokens = await oauthClient.validateAuthorizationCode(token_endpoint, code, null);
	} catch (e: any) {
		logger.error('Error validating authorization code:', e);

		const errorMessage = e?.message || 'Unknown error';
		logger.error('Token exchange error details:', errorMessage);

		event.cookies.delete('obp_oauth_state', {
			path: '/'
		});

		let userMessage = 'Authentication failed. Please try again.';
		if (
			errorMessage.toLowerCase().includes('invalid') ||
			errorMessage.toLowerCase().includes('expired')
		) {
			userMessage = 'Your login session expired. Please try again.';
		}

		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent(userMessage)}`
			}
		});
	}

	event.cookies.delete('obp_oauth_state', {
		path: '/'
	});

	const obpAccessToken = tokens.accessToken();

	logger.debug(`PUBLIC_OBP_BASE_URL from env: ${env.PUBLIC_OBP_BASE_URL}`);
	const currentUserUrl = `${env.PUBLIC_OBP_BASE_URL}/obp/v6.0.0/users/current`;
	logger.info('Fetching current user from OBP:', currentUserUrl);
	const currentUserRequest = new Request(currentUserUrl);

	currentUserRequest.headers.set('Authorization', `Bearer ${obpAccessToken}`);
	logger.debug('Making OBP current user request with access token');

	const currentUserResponse = await fetch(currentUserRequest);
	if (!currentUserResponse.ok) {
		const errorText = await currentUserResponse.text();
		logger.error(
			`OBP current user request failed - Status: ${currentUserResponse.status}, Response: ${errorText}`
		);

		event.cookies.delete('obp_oauth_state', {
			path: '/'
		});

		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Failed to retrieve user information. Please try again or contact your administrator.')}`
			}
		});
	}
	const user = await currentUserResponse.json();
	logger.info(
		`Successfully fetched current user from OBP - User ID: ${user.user_id}, Email: ${user.email}, Username: ${user.username || 'N/A'}`
	);
	logger.debug('Full current user data:', user);

	if (user.user_id && user.email) {
		const { session } = event.locals;
		await session.setData({
			user: user,
			oauth: {
				access_token: obpAccessToken,
				refresh_token: tokens.refreshToken(),
				provider: provider
			}
		});
		await session.save();
		logger.debug('Session data set:', session.data);
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/`
			}
		});
	} else {
		logger.error('Invalid user data received from OBP - missing user_id or email:', user);

		event.cookies.delete('obp_oauth_state', {
			path: '/'
		});

		return new Response(null, {
			status: 302,
			headers: {
				Location: `/login?error=${encodeURIComponent('Invalid user data received. Please contact your administrator.')}`
			}
		});
	}
}
