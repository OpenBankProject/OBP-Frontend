import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OpeyAuthServer');
import { extractUsernameFromJWT } from '$lib/utils/jwt';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { obpIntegrationService } from '$lib/opey/services/OBPIntegrationService';
import { env } from '$env/dynamic/private';
import type { Session } from 'svelte-kit-sessions';

export async function POST(event: RequestEvent) {
	try {
		const session = event.locals.session;
		const accessToken = session?.data?.oauth?.access_token;

		// Check if this is an authenticated request
		if (accessToken) {
			const opeyConsumerId = env.OPEY_CONSUMER_ID;
			if (!opeyConsumerId) {
				// Opey consumer ID is not configured
				// We will return an anonymous session instead, with a warning/error

				logger.warn('Opey consumer ID not configured, returning anonymous session');
				return await _getAnonymousSession(
					'Opey consumer ID not configured, returning anonymous session instead.'
				);
			}

			try {
				// AUTHENTICATED FLOW - Create consent and authenticated Opey session
				return await _getAuthenticatedSession(opeyConsumerId, session);
			} catch (error: any) {
				logger.info('JWT expired for Opey session - user needs to re-authenticate:', error);
				return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
			}
		} else {
			// ANONYMOUS FLOW - Create anonymous Opey session
			return await _getAnonymousSession();
		}
	} catch (error: any) {
		logger.error('Opey Auth error:', error);
		return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}

async function _getAuthenticatedSession(opeyConsumerId: string, portalSession: Session) {
	// AUTHENTICATED FLOW - Create consent and authenticated Opey session

	const consent = await obpIntegrationService.getOrCreateOpeyConsent(portalSession);
	const consentJwt = consent.jwt;
	const consentId = consent.consent_id;
	const accessToken = portalSession.data?.oauth?.access_token;

	// Extract and log user identifier from consent JWT
	const userIdentifier = extractUsernameFromJWT(consentJwt);
	logger.info(
		`_getAuthenticatedSession says: Sending consent JWT to Opey - Making request to ${env.OPEY_BASE_URL}/create-session - Primary user: ${userIdentifier}`
	);

	const opeyResponse = await fetch(`${env.OPEY_BASE_URL}/create-session`, {
		method: 'POST',
		headers: {
			'Consent-Id': consentId,
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		}
	});

	if (!opeyResponse.ok) {
		const errorText = await opeyResponse.text();
		logger.error(
			`_getAuthenticatedSession says: Failed to create authenticated Opey session - Primary user: ${userIdentifier} - Error: ${errorText}`
		);
		throw new Error(`Failed to create authenticated Opey session: ${errorText}`);
	}

	logger.info(
		`_getAuthenticatedSession says: Successfully created authenticated Opey session - Primary user: ${userIdentifier}`
	);

	// Forward the session cookie to the client
	const setCookieHeaders = opeyResponse.headers.get('set-cookie');
	logger.info(`setCookieHeaders: ${setCookieHeaders}`);
	return json(
		{ success: true, authenticated: true },
		setCookieHeaders ? { headers: { 'Set-Cookie': setCookieHeaders } } : {}
	);
}

async function _getAnonymousSession(error?: string) {
	// ANONYMOUS FLOW - Create anonymous Opey session
	logger.info(
		`_getAnonymousSession says: Creating anonymous Opey session - Making request to ${env.OPEY_BASE_URL}/create-session (no consent JWT)`
	);

	const opeyResponse = await fetch(`${env.OPEY_BASE_URL}/create-session`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		}
		// No Consent-JWT header = anonymous session
	});

	if (!opeyResponse.ok) {
		const errorText = await opeyResponse.text();
		logger.error(
			`_getAnonymousSession says: Failed to create anonymous Opey session - Error: ${errorText}`
		);
		throw new Error(`Failed to create anonymous Opey session: ${errorText}`);
	}

	logger.info(`_getAnonymousSession says: Successfully created anonymous Opey session`);

	// Forward the session cookie to the client
	const setCookieHeaders = opeyResponse.headers.get('set-cookie');
	const responseData: any = { success: true, authenticated: false };

	if (error) {
		responseData.error = error;
	}

	return json(
		responseData,
		setCookieHeaders ? { headers: { 'Set-Cookie': setCookieHeaders } } : {}
	);
}
