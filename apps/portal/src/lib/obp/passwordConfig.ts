import { createLogger } from '@obp/shared/utils';
import type { OBPPasswordPolicies } from '@obp/shared/obp';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('PasswordConfig');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: OBPPasswordPolicies | null = null;
let cachedAt = 0;

/**
 * The password policy published by the API, for validating a proposed password
 * locally during registration and password reset. Returns null when the config
 * cannot be fetched — callers must then skip local validation and let the API
 * enforce the policy (OBP-30207).
 */
export async function getPasswordPolicies(): Promise<OBPPasswordPolicies | null> {
	if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
		return cached;
	}
	try {
		cached = await obp_requests.get('/obp/v7.0.0/public/password-config');
		cachedAt = Date.now();
		return cached;
	} catch (error) {
		logger.warn(
			'Could not fetch password config, deferring password validation to the API:',
			error instanceof Error ? error.message : error
		);
		return null;
	}
}
