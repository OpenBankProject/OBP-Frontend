/**
 * The consent a chat turn used, seen from the proxy: the consent JWT the browser sends
 * back to Opey inside `tool_call_approval.consent_jwt`. Its `jti` is the OBP consent_id;
 * the stable `consent_reference_id` the metrics pages filter on is not a JWT claim, so it
 * is looked up in the user's /my/consents listing.
 */
import { getJWTPayload } from '../../utils/jwt';

/** Path of the listing the reference id is resolved from. */
export const MY_CONSENTS_PATH = '/obp/v5.1.0/my/consents';

/** The consent JWT carried by a proxied /stream request body, if any. */
export function consentJwtFromBody(body: unknown): string | null {
	const jwt = (body as any)?.tool_call_approval?.consent_jwt;
	return typeof jwt === 'string' && jwt ? jwt : null;
}

/** The OBP consent_id (`jti`) of a consent JWT, or null when it cannot be read. */
export function consentIdFromJwt(jwt: string): string | null {
	const payload = getJWTPayload(jwt) as any;
	const jti = payload?.jti;
	return typeof jti === 'string' && jti ? jti : null;
}

/**
 * Resolve a consent_id to its consent_reference_id from the user's own consents listing.
 * Best effort: any failure, or no match, yields null and the turn is recorded without it.
 */
export async function resolveConsentReferenceId(
	obpGet: (path: string, accessToken?: string) => Promise<any>,
	accessToken: string,
	consentId: string
): Promise<string | null> {
	try {
		const data = await obpGet(MY_CONSENTS_PATH, accessToken);
		const consents: any[] = Array.isArray(data?.consents) ? data.consents : [];
		const match = consents.find((c) => c?.consent_id === consentId);
		const ref = match?.consent_reference_id;
		return typeof ref === 'string' && ref ? ref : null;
	} catch {
		return null;
	}
}
