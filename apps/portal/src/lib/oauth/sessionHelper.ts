import { createLogger } from '@obp/shared/utils';
const logger = createLogger('OAuthSessionHelper');
import { oauth2ProviderFactory } from './providerFactory';
import type { OAuth2ClientWithConfig } from './client';
import type { Session } from 'svelte-kit-sessions';
import type { SessionOAuthStorageData } from './types';



export interface SessionOAuthData {
	client: OAuth2ClientWithConfig;
	provider: string;
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
}

export class SessionOAuthHelper {
	/**
	 * Get the OAuth client and tokens from session
	 * @param session - The user session
	 * @returns SessionOAuthData if valid, null if invalid/missing
	 */
	static getSessionOAuth(session: Session): SessionOAuthData | null {
		const oauthData = session.data.oauth as SessionOAuthStorageData;
		if (!oauthData?.provider || !oauthData?.access_token) {
			return null;
		}

		const client = oauth2ProviderFactory.getClient(oauthData.provider);
		if (!client) {
			logger.error(`OAuth client for provider "${oauthData.provider}" not found.`);
			return null;
		}
		return {
			client,
			provider: oauthData.provider,
			accessToken: oauthData.access_token,
			refreshToken: oauthData.refresh_token,
			idToken: oauthData.id_token
		};
	}

	static async updateTokensInSession(
		session: Session,
		accessToken: string,
		refreshToken?: string,
		idToken?: string
	): Promise<void> {
		const currentOauth = session.data.oauth as SessionOAuthStorageData;
		if (!currentOauth) {
			throw new Error('No OAuth data in session to update.');
		}

		await session.setData({
			...session.data,
			oauth: {
				...currentOauth,
				access_token: accessToken,
				refresh_token: refreshToken || currentOauth.refresh_token, // Keep existing refresh token if not provided
				id_token: idToken || currentOauth.id_token // Keep existing ID token if not provided
			} as SessionOAuthStorageData
		});

		await session.save();
	}

	static async refreshAccessToken(session: Session): Promise<void> {
		logger.debug('Attempting to refresh access token in session...');

		const sessionOAuth = this.getSessionOAuth(session);
		if (!sessionOAuth) {
			logger.warn('No valid OAuth data found in session. Cannot refresh access token.');
			throw new Error('No valid OAuth data found in session. Please log in again.');
		}

		const { client, provider, refreshToken } = sessionOAuth;
		const refreshEndpoint = client.OIDCConfig?.token_endpoint;

		if (!refreshEndpoint || !refreshToken) {
			logger.warn(`No refresh endpoint or refresh token found for provider: ${provider}`);
			throw new Error('No refresh endpoint or refresh token found. Please log in again.');
		}

		try {
			logger.debug(`Refreshing access token for provider: ${provider}...`);
			const tokens = await client.refreshAccessToken(refreshEndpoint, refreshToken, ['openid']);

			// Google access tokens are opaque and can't be validated by OBP;
			// the id_token is the JWT that OBP verifies against Google's JWKS.
			await this.updateTokensInSession(
				session,
				provider === 'google' ? tokens.idToken() : tokens.accessToken(),
				tokens.refreshToken() || refreshToken,
				tokens.idToken()
			);

			logger.info(`Access token refreshed successfully for provider: ${provider}`);
		} catch (error) {
			logger.info(
				`Token refresh failed for provider ${provider} - this is normal OAuth behavior when tokens expire:`,
				error
			);
			throw new Error('Failed to refresh access token. Please log in again.');
		}
	}
}
