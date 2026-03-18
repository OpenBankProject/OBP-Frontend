import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ConfirmBGConsentRequestRedirectURI');
import type { RequestEvent } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';

function decodeJwtPayload(jwt: string): any {
	try {
		const parts = jwt.split('.');
		if (parts.length !== 3) return {};
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
		return JSON.parse(jsonPayload);
	} catch {
		logger.warn('Could not decode JWT payload');
		return {};
	}
}

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');


	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			tppRedirectUri: '',
			tppNokRedirectUri: '',
			status: '',
			};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentId,
			tppRedirectUri: '',
			tppNokRedirectUri: '',
			status: '',
			};
	}

	try {
		const consent = await obp_requests.get(
			`/obp/v5.1.0/user/current/consents/${consentId}`,
			token
		);

		const jwtPayload = decodeJwtPayload(consent.jwt);
		const requestHeaders = jwtPayload.request_headers || [];

		let tppRedirectUri = '';
		let tppNokRedirectUri = '';
		for (const header of requestHeaders) {
			if (header['TPP-Redirect-URI']) {
				tppRedirectUri = header['TPP-Redirect-URI'];
			}
			if (header['TPP-Nok-Redirect-URI']) {
				tppNokRedirectUri = header['TPP-Nok-Redirect-URI'];
			}
		}

		return {
			consentId,
			tppRedirectUri,
			tppNokRedirectUri,
			status: consent.status,
			};
	} catch (e) {
		logger.error('Error fetching consent for redirect:', e);
		let errorMessage = 'Could not fetch consent details.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return {
			loadError: errorMessage,
			consentId,
			tppRedirectUri: '',
			tppNokRedirectUri: '',
			status: '',
			};
	}
}
