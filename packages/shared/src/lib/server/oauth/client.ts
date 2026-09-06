/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { createLogger } from '$shared/utils/logger';
import { redactUrlEncodedBody } from '$shared/utils/redact';
const logger = createLogger('OAuth2Client');
import { OAuth2Client } from 'arctic';
import type { OpenIdConnectConfiguration, OAuth2AccessTokenPayload } from './types';
import { jwtDecode } from 'jwt-decode';

export class OAuth2ClientWithConfig extends OAuth2Client {
	OIDCConfig?: OpenIdConnectConfiguration;
	private readonly storedClientId: string;
	private readonly storedClientSecret: string;
	private readonly storedRedirectURI: string;
	private readonly providerType: string;

	constructor(
		clientId: string,
		clientSecret: string,
		redirectUri: string,
		providerType: string = 'default'
	) {
		super(clientId, clientSecret, redirectUri);

		// Store credentials for our custom methods to access private properties
		this.storedClientId = clientId;
		this.storedClientSecret = clientSecret;
		this.storedRedirectURI = redirectUri;
		this.providerType = providerType;
	}

	async initOIDCConfig(OIDCConfigUrl: string): Promise<void> {
		logger.info('Initializing OIDC configuration from OIDC Config URL:', OIDCConfigUrl);
		let config: any;
		try {
			// Fetch OIDC configuration (OAuth2.1 compliant)
			const response = await fetch(OIDCConfigUrl);
			if (!response.ok) {
				logger.error(`Failed to fetch OIDC config: ${response.status} ${response.statusText}`);
				return;
			}
			config = await response.json();
			logger.debug('Raw OIDC config received:', JSON.stringify(config, null, 2));
		} catch (error) {
			throw new Error(`Error fetching OIDC config: ${error}`);
		}

		// Validate required endpoints outside of try/catch to avoid local-catch warnings
		if (!config?.authorization_endpoint || !config?.token_endpoint) {
			logger.error('Invalid OIDC config: Missing required endpoints.');
			logger.error(`Authorization endpoint: ${config?.authorization_endpoint || 'MISSING'}`);
			logger.error(`Token endpoint: ${config?.token_endpoint || 'MISSING'}`);
			return;
		}

		// Assign after validation
		this.OIDCConfig = config as OpenIdConnectConfiguration;
		logger.info('OIDC config initialization success.');
		logger.debug(`Configured authorization endpoint: ${this.OIDCConfig.authorization_endpoint}`);
		logger.debug(`Configured token endpoint: ${this.OIDCConfig.token_endpoint}`);
	}

	async checkAccessTokenExpiration(accessToken: string): Promise<boolean> {
		// Returns true if the access token is expired (or its validity can't be
		// determined — treated as expired so the caller attempts a refresh rather
		// than either 500ing or treating an unverifiable token as eternally valid),
		// false if it is confirmed valid.
		logger.debug('Checking access token expiration...');
		try {
			const payload = jwtDecode(accessToken) as OAuth2AccessTokenPayload;
			if (!payload || !payload.exp) {
				logger.warn('Access token payload is invalid or missing expiration.');
				return true;
			}
			const isExpired = Date.now() >= payload.exp * 1000;
			logger.debug(`Access token is ${isExpired ? 'expired' : 'valid'}.`);
			return isExpired;
		} catch (error) {
			logger.warn('Could not decode access token; treating as expired:', error);
			return true;
		}
	}

	createAuthorizationURL(authEndpoint: string, state: string, scopes: string[]): URL {
		return super.createAuthorizationURL(authEndpoint, state, scopes);
	}

	async validateAuthorizationCode(
		tokenEndpoint: string,
		code: string,
		codeVerifier: string | null
	): Promise<any> {
		// Use a unified modern flow for all providers with built-in fallback
		// This ensures consistent behavior across providers (Keycloak and OBP-OIDC)
		return this.validateAuthorizationCodeModern(tokenEndpoint, code, codeVerifier);
	}

	private async validateAuthorizationCodeLegacy(
		tokenEndpoint: string,
		code: string,
		codeVerifier: string | null
	): Promise<any> {
		logger.debug('Validating authorization code with legacy method (OBP-OIDC)');

		const body = new URLSearchParams();
		body.set('grant_type', 'authorization_code');
		body.set('code', code);
		body.set('redirect_uri', this.storedRedirectURI);
		body.set('client_id', this.storedClientId);

		if (this.storedClientSecret) {
			body.set('client_secret', this.storedClientSecret);
		}

		if (codeVerifier) {
			body.set('code_verifier', codeVerifier);
		}

		logger.debug(`Token request body: ${redactUrlEncodedBody(body)}`);

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: body.toString()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			logger.error(`Token endpoint error - Status: ${response.status}, Data:`, errorData);
			throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
		}

		const tokens = await response.json();
		logger.debug('Token response received successfully');

		return {
			accessToken: () => tokens.access_token,
			refreshToken: () => tokens.refresh_token,
			idToken: () => {
				if ('id_token' in tokens && typeof tokens.id_token === 'string') {
					return tokens.id_token;
				}
				throw new Error("Missing or invalid field 'id_token'");
			},
			accessTokenExpiresAt: () =>
				tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
		};
	}

	private async validateAuthorizationCodeModern(
		tokenEndpoint: string,
		code: string,
		codeVerifier: string | null
	): Promise<any> {
		logger.debug('Validating authorization code with modern method (KeyCloak)');

		const body = new URLSearchParams();
		body.set('grant_type', 'authorization_code');
		body.set('code', code);
		body.set('redirect_uri', this.storedRedirectURI);

		// Prepare headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		};

		// Use HTTP Basic Authentication for client credentials (RFC 6749 Section 2.3.1)
		if (this.storedClientSecret) {
			const credentials = Buffer.from(`${this.storedClientId}:${this.storedClientSecret}`).toString(
				'base64'
			);
			headers['Authorization'] = `Basic ${credentials}`;
			logger.debug('Using Basic Authentication for client credentials');
		} else {
			// Public client - include client_id in body
			body.set('client_id', this.storedClientId);
			logger.debug('Using client_id in request body (public client)');
		}

		if (codeVerifier) {
			body.set('code_verifier', codeVerifier);
		}

		logger.debug(`Token request body: ${redactUrlEncodedBody(body)}`);

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers,
			body: body.toString()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			logger.error(`Token endpoint error - Status: ${response.status}, Data:`, errorData);

			// If Basic Auth failed and we have a client secret, try with credentials in body as fallback
			if (response.status === 401 && this.storedClientSecret && !body.has('client_id')) {
				logger.warn('Basic Auth failed, retrying with credentials in request body');

				// Add client credentials to body for retry
				body.set('client_id', this.storedClientId);
				body.set('client_secret', this.storedClientSecret);

				// Remove Authorization header
				delete headers['Authorization'];

				const retryResponse = await fetch(tokenEndpoint, {
					method: 'POST',
					headers,
					body: body.toString()
				});

				if (!retryResponse.ok) {
					const retryErrorData = await retryResponse.json().catch(() => ({}));
					logger.error(
						`Token endpoint retry error - Status: ${retryResponse.status}, Data:`,
						retryErrorData
					);
					throw new Error(
						`Token request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`
					);
				}

				const retryTokens = await retryResponse.json();
				logger.debug('Token response received successfully after retry');

				return {
					accessToken: () => retryTokens.access_token,
					refreshToken: () => retryTokens.refresh_token,
					idToken: () => {
						if ('id_token' in retryTokens && typeof retryTokens.id_token === 'string') {
							return retryTokens.id_token;
						}
						throw new Error("Missing or invalid field 'id_token'");
					},
					accessTokenExpiresAt: () =>
						retryTokens.expires_in ? new Date(Date.now() + retryTokens.expires_in * 1000) : null
				};
			}

			throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
		}

		const tokens = await response.json();
		logger.debug('Token response received successfully');

		return {
			accessToken: () => tokens.access_token,
			refreshToken: () => tokens.refresh_token,
			idToken: () => {
				if ('id_token' in tokens && typeof tokens.id_token === 'string') {
					return tokens.id_token;
				}
				throw new Error("Missing or invalid field 'id_token'");
			},
			accessTokenExpiresAt: () =>
				tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
		};
	}

	async refreshAccessToken(
		tokenEndpoint: string,
		refreshToken: string,
		scopes: string[]
	): Promise<any> {
		logger.debug('Refreshing access token...');

		const body = new URLSearchParams();
		body.set('grant_type', 'refresh_token');
		body.set('refresh_token', refreshToken);

		if (scopes && scopes.length > 0) {
			body.set('scope', scopes.join(' '));
		}

		// Prepare headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		};

		// Use HTTP Basic Authentication for client credentials
		if (this.storedClientSecret) {
			const credentials = Buffer.from(`${this.storedClientId}:${this.storedClientSecret}`).toString(
				'base64'
			);
			headers['Authorization'] = `Basic ${credentials}`;
			logger.debug('Using Basic Authentication for refresh token request');
		} else {
			// Public client - include client_id in body
			body.set('client_id', this.storedClientId);
			logger.debug('Using client_id in request body for refresh token request');
		}

		logger.debug(`Refresh token request body: ${body.toString()}`);

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers,
			body: body.toString()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			logger.error(`Token refresh error - Status: ${response.status}, Data:`, errorData);

			// If Basic Auth failed and we have a client secret, try with credentials in body as fallback
			if (response.status === 401 && this.storedClientSecret && !body.has('client_id')) {
				logger.warn('Basic Auth failed for refresh, retrying with credentials in request body');

				// Add client credentials to body for retry
				body.set('client_id', this.storedClientId);
				body.set('client_secret', this.storedClientSecret);

				// Remove Authorization header
				delete headers['Authorization'];

				const retryResponse = await fetch(tokenEndpoint, {
					method: 'POST',
					headers,
					body: body.toString()
				});

				if (!retryResponse.ok) {
					const retryErrorData = await retryResponse.json().catch(() => ({}));
					logger.error(
						`Token refresh retry error - Status: ${retryResponse.status}, Data:`,
						retryErrorData
					);
					throw new Error(
						`Token refresh failed after retry: ${retryResponse.status} ${retryResponse.statusText}`
					);
				}

				const retryTokens = await retryResponse.json();
				logger.debug('Token refresh response received successfully after retry');

				return {
					accessToken: () => retryTokens.access_token,
					refreshToken: () => retryTokens.refresh_token,
					idToken: () => {
						if ('id_token' in retryTokens && typeof retryTokens.id_token === 'string') {
							return retryTokens.id_token;
						}
						throw new Error("Missing or invalid field 'id_token'");
					},
					accessTokenExpiresAt: () =>
						retryTokens.expires_in ? new Date(Date.now() + retryTokens.expires_in * 1000) : null
				};
			}

			throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
		}

		const tokens = await response.json();
		logger.debug('Token refresh response received successfully');

		return {
			accessToken: () => tokens.access_token,
			refreshToken: () => tokens.refresh_token,
			idToken: () => {
				if ('id_token' in tokens && typeof tokens.id_token === 'string') {
					return tokens.id_token;
				}
				throw new Error("Missing or invalid field 'id_token'");
			},
			accessTokenExpiresAt: () =>
				tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
		};
	}
}
