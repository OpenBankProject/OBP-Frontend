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

	deleteAll: async ({ locals }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		// Page through /my/consents so we delete every record, not just the
		// 10 the load function fetches for display.
		const pageLimit = 50;
		const all: OBPConsent[] = [];
		try {
			let offset = 0;
			while (true) {
				const resp: { consents?: OBPConsent[] } = await obp_requests.get(
					`/obp/v5.1.0/my/consents?limit=${pageLimit}&offset=${offset}`,
					token
				);
				const batch = resp?.consents ?? [];
				all.push(...batch);
				if (batch.length < pageLimit) break;
				offset += pageLimit;
			}
		} catch (err) {
			logger.error('deleteAll: failed to list consents:', err);
			const msg =
				err instanceof OBPRequestError
					? err.message
					: err instanceof Error
						? err.message
						: 'Failed to list consents for deletion.';
			return { message: msg };
		}

		// Only ACCEPTED or INITIATED consents are meaningfully deletable via
		// DELETE /my/consents/{ID} — REVOKED/REJECTED/EXPIRED rows can't be
		// revoked again. Skip them so the response stays clean instead of
		// surfacing one error per skipped row.
		const DELETABLE_STATUSES = new Set(['ACCEPTED', 'INITIATED']);
		const deletable = all.filter((c) => DELETABLE_STATUSES.has(c.status));
		const skipped = all.length - deletable.length;

		if (deletable.length === 0) {
			return {
				success: true,
				message:
					skipped > 0
						? `No ACCEPTED or INITIATED consents to delete (${skipped} skipped).`
						: 'No consents to delete.'
			};
		}

		let deleted = 0;
		const errors: string[] = [];
		for (const c of deletable) {
			try {
				await obp_requests.delete(`/obp/v5.1.0/my/consents/${c.consent_id}`, token);
				deleted++;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				errors.push(`${String(c.consent_id ?? 'unknown').slice(0, 8)}: ${msg}`);
			}
		}

		const skippedNote = skipped > 0 ? ` (${skipped} skipped — not ACCEPTED or INITIATED)` : '';

		if (errors.length > 0) {
			const sample = errors.slice(0, 3).join('; ');
			const more = errors.length > 3 ? ` (and ${errors.length - 3} more)` : '';
			return {
				message: `Deleted ${deleted} consent${deleted === 1 ? '' : 's'}${skippedNote}. ${errors.length} failed: ${sample}${more}`
			};
		}

		return {
			success: true,
			message: `Deleted ${deleted} consent${deleted === 1 ? '' : 's'}${skippedNote}.`
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
