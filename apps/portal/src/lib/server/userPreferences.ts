/**
 * Server-side helpers for reading and writing per-user preferences stored as OBP
 * "personal data fields" (the `/obp/.../my/personal-data-fields` endpoint). Mirrors
 * the client-side pattern in `apps/portal/src/lib/stores/currentBank.svelte.ts` but
 * for code that runs on the server (consent-creation routes etc).
 *
 * Note: OBP's `user_attributes` is a *different* endpoint with different auth
 * requirements — don't conflate the two. The OBP response payload for
 * personal-data-fields happens to nest the records under a `user_attributes` key,
 * but the endpoint and concept this module talks to is personal data fields.
 */
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('UserPreferences');

interface PersonalDataField {
	user_attribute_id: string;
	name: string;
	value: string;
	type?: string;
}

interface PersonalDataFieldRecord {
	id: string;
	value: string;
}

/** OBP personal-data-field name for the user's preferred Consent-JWT lifetime, in seconds. */
export const OPEY_CONSENT_TTL_FIELD = 'OPEY_CONSENT_TTL_SECONDS';

/** Built-in fallback when nothing else is configured. Currently 7 days. */
export const DEFAULT_OPEY_CONSENT_TTL_SECONDS = 604800;

/** Read a single OBP personal-data-field by name. Returns null if missing or unreadable. */
export async function getPersonalDataField(
	accessToken: string,
	name: string
): Promise<PersonalDataFieldRecord | null> {
	try {
		const res = await obp_requests.get('/obp/v6.0.0/my/personal-data-fields', accessToken);
		const fields: PersonalDataField[] = res?.user_attributes ?? [];
		const found = fields.find((f) => f.name === name);
		if (!found) return null;
		return { id: found.user_attribute_id, value: found.value };
	} catch (err) {
		logger.warn(`Failed to read OBP personal data field '${name}':`, err);
		return null;
	}
}

/** Create or update an OBP personal-data-field by name. */
export async function setPersonalDataField(
	accessToken: string,
	name: string,
	value: string
): Promise<void> {
	const existing = await getPersonalDataField(accessToken, name);
	if (existing) {
		await obp_requests.put(
			`/obp/v6.0.0/my/personal-data-fields/${encodeURIComponent(existing.id)}`,
			{ name, value, type: 'STRING' },
			accessToken
		);
	} else {
		await obp_requests.post(
			'/obp/v6.0.0/my/personal-data-fields',
			{ name, value, type: 'STRING' },
			accessToken
		);
	}
}

/**
 * Resolve the consent TTL (seconds) to use when creating a consent on this user's behalf.
 * Order of precedence:
 *   1. The user's `OPEY_CONSENT_TTL_SECONDS` personal data field, if set to a positive number.
 *   2. The `envDefault` argument (typically `Number(env.OPEY_CONSENT_TTL_SECONDS)`).
 *   3. The built-in default (7 days).
 */
export async function getOpeyConsentTtlSeconds(
	accessToken: string | undefined,
	envDefault?: number
): Promise<number> {
	const fallback =
		Number.isFinite(envDefault) && (envDefault as number) > 0
			? (envDefault as number)
			: DEFAULT_OPEY_CONSENT_TTL_SECONDS;
	if (!accessToken) return fallback;
	const found = await getPersonalDataField(accessToken, OPEY_CONSENT_TTL_FIELD);
	if (!found) return fallback;
	const n = Number(found.value);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Persist the user's chosen consent TTL (seconds) as a personal data field. */
export async function setOpeyConsentTtlSeconds(accessToken: string, seconds: number): Promise<void> {
	await setPersonalDataField(accessToken, OPEY_CONSENT_TTL_FIELD, String(Math.floor(seconds)));
}
