import { createLogger } from '$lib/utils/logger';
const logger = createLogger('UserPageServer');
import type { RequestEvent } from '@sveltejs/kit';
import { obpIntegrationService } from '$lib/server/opey/OBPIntegrationService';
import { env } from '$env/dynamic/private';
import { jwtDecode } from 'jwt-decode';
import type { OAuth2AccessTokenPayload } from '$lib/oauth/types';

function maskString(value: string, visibleChars = 4): string {
	if (value.length <= visibleChars * 2) return '****';
	return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
}

function decodeTokenTimes(token: string): { issuedAt: string | null; expiresAt: string | null; expiresInSeconds: number | null } {
	try {
		const payload = jwtDecode<OAuth2AccessTokenPayload>(token);
		const now = Date.now();
		return {
			issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
			expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
			expiresInSeconds: payload.exp ? Math.round((payload.exp * 1000 - now) / 1000) : null,
		};
	} catch {
		return { issuedAt: null, expiresAt: null, expiresInSeconds: null };
	}
}

export async function load(event: RequestEvent) {
	const session = event.locals.session;
	const userData = session?.data?.user;

	logger.debug('User data from session:', userData);

	let opeyConsentInfo = null;

	// If we have Opey consumer ID configured, get Opey consent info
	if (env.OPEY_CONSUMER_ID) {
		try {
			logger.debug('Checking for Opey consent with consumer ID:', env.OPEY_CONSUMER_ID);

			const existingConsent = await obpIntegrationService.checkExistingOpeyConsent(session);

			if (existingConsent) {
				opeyConsentInfo = {
					hasActiveConsent: true,
					consent: existingConsent
				}
				
				logger.debug(`Active Opey consent found: ${JSON.stringify(existingConsent)}`);
			} else {
				opeyConsentInfo = {
					hasActiveConsent: false,
					message:
						'No active Opey consent found. A consent will be created automatically when you use Opey chat.'
				};
				logger.debug('No active Opey consent found');
			}
		} catch (error) {
			logger.error('Error checking Opey consent:', error);
			opeyConsentInfo = {
				hasActiveConsent: false,
				error: 'Unable to check Opey consent information'
			};
		}
	}

	// Build masked session info for the profile page
	const oauth = session?.data?.oauth;
	const accessToken = oauth?.access_token;
	const refreshToken = oauth?.refresh_token;

	const accessTokenTimes = accessToken ? decodeTokenTimes(accessToken) : null;
	const refreshTokenTimes = refreshToken ? decodeTokenTimes(refreshToken) : null;

	const sessionInfo = {
		sessionId: session?.id ? maskString(session.id) : null,
		oauthProvider: oauth?.provider || null,
		hasAccessToken: !!accessToken,
		accessTokenPreview: accessToken ? maskString(accessToken) : null,
		accessTokenIssuedAt: accessTokenTimes?.issuedAt || null,
		accessTokenExpiresAt: accessTokenTimes?.expiresAt || null,
		accessTokenExpiresInSeconds: accessTokenTimes?.expiresInSeconds ?? null,
		hasRefreshToken: !!refreshToken,
		refreshTokenPreview: refreshToken ? maskString(refreshToken) : null,
		refreshTokenExpiresAt: refreshTokenTimes?.expiresAt || null,
		refreshTokenExpiresInSeconds: refreshTokenTimes?.expiresInSeconds ?? null,
	};

	return {
		userData: userData || null,
		opeyConsentInfo,
		sessionInfo
	};
}
