/**
 * Caps consent TTLs at the OBP server's configured maximum.
 *
 * OBP rejects `POST /obp/.../my/consents/IMPLICIT` with OBP-35020 when
 * `time_to_live` exceeds the server prop `consents.max_time_to_live`. To avoid
 * that error we fetch the public endpoint `GET /obp/v7.0.0/public/consent-config`
 * (which returns `max_time_to_live_in_seconds`) and clamp our requested TTL
 * against it before creating the consent.
 *
 * The endpoint may not yet exist on older OBP versions — in that case the
 * helper returns `null` and capping is silently skipped. Callers should keep
 * their existing TTL choice unchanged in that case.
 *
 * Cached in-process: 1 hour on success, 5 minutes on miss/error (so a deploy
 * that adds the endpoint is picked up reasonably quickly without spamming).
 */

import { createLogger } from '$shared/utils/logger';

const logger = createLogger('ConsentsConfig');

const CACHE_OK_TTL_MS = 60 * 60 * 1000;
const CACHE_MISS_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
	value: number | null;
	expiresAt: number;
}

let cache: CacheEntry | null = null;

/** Shape compatible with each app's `obp_requests.get(path, accessToken?)`. */
export type ObpGet = (path: string, accessToken?: string) => Promise<any>;

/**
 * Return the server's `consents.max_time_to_live` (in seconds), or `null` if
 * the endpoint is unavailable on this OBP version.
 */
export async function getConsentsMaxTtlSeconds(obpGet: ObpGet): Promise<number | null> {
	const now = Date.now();
	if (cache && cache.expiresAt > now) return cache.value;

	try {
		const data = await obpGet('/obp/v7.0.0/public/consent-config');
		const raw = data?.max_time_to_live_in_seconds;
		const max = typeof raw === 'number' && raw > 0 ? raw : null;
		cache = {
			value: max,
			expiresAt: now + (max !== null ? CACHE_OK_TTL_MS : CACHE_MISS_TTL_MS)
		};
		if (max !== null) {
			logger.debug(`OBP consents max TTL: ${max}s (~${(max / 86400).toFixed(1)} days)`);
		} else {
			logger.debug('OBP /public/consent-config returned no max_time_to_live_in_seconds — capping disabled.');
		}
		return max;
	} catch (err: unknown) {
		// Most likely cause on current OBP versions: endpoint not deployed yet.
		// Keep this at debug so it isn't noisy in production logs.
		const msg = err instanceof Error ? err.message : String(err);
		cache = { value: null, expiresAt: now + CACHE_MISS_TTL_MS };
		logger.debug(`OBP /public/consent-config unavailable, TTL capping disabled: ${msg}`);
		return null;
	}
}

/**
 * Clamp a desired consent TTL (seconds) against the OBP server's configured
 * maximum. Returns the effective TTL plus diagnostic info so the caller can
 * log when it had to clamp.
 *
 * Usage:
 *   const { ttl, max, capped } = await capConsentTtlSeconds(
 *     desired,
 *     (p, t) => obp_requests.get(p, t)
 *   );
 *   if (capped) logger.info(`TTL clamped: requested ${desired}s, OBP max ${max}s`);
 */
export async function capConsentTtlSeconds(
	desiredSeconds: number,
	obpGet: ObpGet
): Promise<{ ttl: number; max: number | null; capped: boolean }> {
	const max = await getConsentsMaxTtlSeconds(obpGet);
	if (max === null) return { ttl: desiredSeconds, max: null, capped: false };
	const ttl = Math.min(desiredSeconds, max);
	return { ttl, max, capped: ttl < desiredSeconds };
}

/** For tests. */
export function _resetConsentsConfigCache(): void {
	cache = null;
}
