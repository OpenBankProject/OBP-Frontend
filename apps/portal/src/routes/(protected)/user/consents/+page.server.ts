import { createLogger } from '@obp/shared/utils';
const logger = createLogger('UserConsentsServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { OBPConsent } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';

const displayConsent = (consent: OBPConsent): boolean => {
	// We want to display the consent if it is revoked and not more than a day old

	// If the consent is not revoked, display it
	if (consent.status !== 'REVOKED') {
		return true;
	}

	const lastActionDate = consent.last_action_date;

	const currentDate = new Date();
	const lastAction = new Date(lastActionDate);
	const timeDifference = currentDate.getTime() - lastAction.getTime();

	// Check if the last action date is within the last 24 hours
	return timeDifference <= 24 * 60 * 60 * 1000;
};

const VALID_STATUSES = ['INITIATED', 'ACCEPTED', 'REJECTED', 'REVOKED'] as const;

/** Decode a JWT's payload segment (no signature check — display only). */
function decodeJwtPayload(jwt: string | undefined): Record<string, any> | null {
	const segment = jwt?.split('.')[1];
	if (!segment) return null;
	try {
		const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
	} catch {
		return null;
	}
}

/**
 * OBP returns `jwt_payload` as a JSON *string* (alongside the raw `jwt`). Normalise it
 * to a parsed object so the page can show which roles/views the consent actually grants.
 * Falls back to decoding the `jwt` itself for API versions that omit `jwt_payload`.
 */
function normalizeConsentPayload(consent: OBPConsent): OBPConsent {
	const raw = consent.jwt_payload as unknown;
	let payload: Record<string, any> | null = null;
	if (typeof raw === 'string') {
		try {
			payload = JSON.parse(raw);
		} catch {
			payload = null;
		}
	} else if (raw && typeof raw === 'object') {
		payload = raw as Record<string, any>;
	}
	if (!payload) {
		payload = decodeJwtPayload(consent.jwt) ?? {};
	}
	payload.entitlements = Array.isArray(payload.entitlements) ? payload.entitlements : [];
	payload.views = Array.isArray(payload.views) ? payload.views : [];
	return { ...consent, jwt_payload: payload as OBPConsent['jwt_payload'] };
}

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, {
			message: 'Unauthorized: No access token found in session.'
		});
	}

	const statusParam = event.url.searchParams.get('status');
	const status = statusParam && VALID_STATUSES.includes(statusParam as any) ? statusParam : null;

	let endpoint = '/obp/v5.1.0/my/consents?limit=10&sort_by=created_date:desc';
	if (status) {
		endpoint += `&status=${status}`;
	}

	let consentResponse: { consents: OBPConsent[] } | undefined = undefined;

	try {
		consentResponse = await obp_requests.get(endpoint, token);
	} catch (e) {
		logger.error('Error fetching consents:', e);
		error(500, {
			message: 'Could not fetch consents at this time. Please try again later.'
		});
	}

	if (!consentResponse || !consentResponse.consents) {
		error(500, {
			message: 'Could not fetch consents at this time. Please try again later.'
		});
	}

	let consents = consentResponse.consents;

	for (let consent of consents) {
		// Filter out consents that should not be displayed
		if (!displayConsent(consent)) {
			// If the consent should not be displayed, set it to null
			consents = consents.filter((c) => c.consent_id !== consent.consent_id);
		}
	}

	// Parse each consent's jwt_payload so the page can render its roles/views.
	consents = consents.map(normalizeConsentPayload);

	// Split consents into Opey and Other consents
	const opeyConsents = consents.filter((consent: OBPConsent) =>
		consent.consumer_id === env.OPEY_CONSUMER_ID
	);

	const otherConsents = consents.filter((consent: OBPConsent) =>
		consent.consumer_id !== env.OPEY_CONSUMER_ID
	);

	// Sort both arrays by created date, most recent first (only if created_date exists)
	const sortByCreatedDate = (a: OBPConsent, b: OBPConsent) => {
		const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
		const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
		return dateB - dateA; // Most recent first
	};

	opeyConsents.sort(sortByCreatedDate);
	otherConsents.sort(sortByCreatedDate);

	return {
		opeyConsents,
		otherConsents,
		activeStatus: status
	};
}

export const actions = {
	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const consentId = data.get('consent_id');

		if (!consentId) {
			return {
				message: 'Consent ID is required.'
			};
		}

		// Get the access token from the session
		const token = locals.session.data.oauth?.access_token;

		if (!token) {
			return {
				message: 'No access token found in session.'
			};
		}

		// Make request to OBP to delete the consent
		try {
			const response = await obp_requests.delete(`/obp/v5.1.0/my/consents/${consentId}`, token);
		} catch (err) {
			logger.error('Error deleting consent:', err);
			let errorMessage = 'Failed to delete consent.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return {
				message: errorMessage
			};
		}

		return {
			success: true,
			message: 'Consent deleted successfully.'
		};
	}
} satisfies Actions;
