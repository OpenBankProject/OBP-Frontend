import { createLogger } from '@obp/shared/utils';
const logger = createLogger('UserConsentsServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { OBPConsent } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';
import {
	getPersonalDataField,
	setPersonalDataField,
	OPEY_CONSENT_TTL_FIELD,
	DEFAULT_OPEY_CONSENT_TTL_SECONDS
} from '$lib/server/userPreferences';

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

	const consents = consentResponse.consents.filter(displayConsent);

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

	// Load the user's preferred consent TTL (OBP personal data field), falling back
	// to env / built-in default. Surface seconds + an env-configurable max so the UI
	// can render only options that won't be rejected by OBP-35020.
	const ttlField = await getPersonalDataField(token, OPEY_CONSENT_TTL_FIELD);
	const envDefault = Number(env.OPEY_CONSENT_TTL_SECONDS);
	const parsed = ttlField ? Number(ttlField.value) : NaN;
	const currentConsentTtlSeconds: number =
		Number.isFinite(parsed) && parsed > 0
			? parsed
			: Number.isFinite(envDefault) && envDefault > 0
				? envDefault
				: DEFAULT_OPEY_CONSENT_TTL_SECONDS;
	const maxConsentTtlSeconds: number = Number(env.OPEY_CONSENT_TTL_MAX_SECONDS) || 7776000; // 90 days

	return {
		opeyConsents,
		otherConsents,
		activeStatus: status,
		currentConsentTtlSeconds,
		maxConsentTtlSeconds
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
	},

	setConsentTtl: async ({ request, locals }) => {
		const data = await request.formData();
		const rawSeconds = data.get('seconds');
		const seconds = Number(rawSeconds);
		if (!Number.isFinite(seconds) || seconds <= 0) {
			return { message: 'Invalid consent duration.' };
		}

		const max = Number(env.OPEY_CONSENT_TTL_MAX_SECONDS) || 7776000;
		if (seconds > max) {
			return { message: `Duration exceeds the configured max (${max}s).` };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			await setPersonalDataField(token, OPEY_CONSENT_TTL_FIELD, String(Math.floor(seconds)));
		} catch (err) {
			logger.error('Error saving consent TTL preference:', err);
			const errorMessage =
				err instanceof OBPRequestError
					? err.message
					: err instanceof Error
						? err.message
						: 'Failed to save consent duration.';
			return { message: errorMessage };
		}

		return { success: true, message: 'Consent duration saved.' };
	}
} satisfies Actions;
