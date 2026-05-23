/**
 * Reuse logic for per-tool-call consents.
 *
 * Without this, every consent_request from Opey mints a fresh consent at OBP
 * even when an existing one already covers the required scope. That's what
 * was causing "asking for the same views again and again" in the chat: every
 * tool call resulted in a new consent record with identical claims.
 *
 * "Covers" is a subset check:
 *   - consumer_id matches the Opey consumer.
 *   - status === 'ACCEPTED'.
 *   - `jwt_expires_at` is in the future. (Note: OBP returns `jwt_payload` as a
 *     JSON STRING in this listing, so we don't trust `consent.jwt_payload.exp`
 *     here either — same trap as the baseline session-consent reuse fix. See
 *     [[reference-obp-consents-jwt-payload-is-string]].)
 *   - Every required `(role_name, bank_id)` is present in the consent's
 *     entitlements (subset, not equality — broader consents still cover).
 *   - Every required `(bank_id, account_id, view_id)` is present in the
 *     consent's views (likewise subset).
 *
 * OBP returns consents sorted by `created_date:desc` by default, so the first
 * match is the most recent — gives a stable, predictable reuse target.
 */

import { createLogger } from '$shared/utils/logger';
import type { ObpGet } from './consentsConfig.js';

const logger = createLogger('ConsentReuse');

export interface RequiredEntitlement {
	role_name: string;
	/** Empty string for system-wide roles. */
	bank_id: string;
}

export interface RequiredView {
	bank_id: string;
	account_id: string;
	view_id: string;
}

export interface ReusableConsent {
	consent_id: string;
	jwt: string;
	status: string;
}

export async function findReusableConsent(opts: {
	obpGet: ObpGet;
	accessToken: string;
	opeyConsumerId: string;
	requiredEntitlements: RequiredEntitlement[];
	requiredViews: RequiredView[];
}): Promise<ReusableConsent | null> {
	const {
		obpGet,
		accessToken,
		opeyConsumerId,
		requiredEntitlements,
		requiredViews
	} = opts;

	logger.info(
		`findReusableConsent: scanning for reuse — consumer=${opeyConsumerId}, required entitlements=${JSON.stringify(requiredEntitlements)}, required views=${JSON.stringify(requiredViews)}`
	);

	let list: any;
	try {
		list = await obpGet('/obp/v5.1.0/my/consents', accessToken);
	} catch (err) {
		logger.info('findReusableConsent: failed to fetch /my/consents — skipping reuse', err);
		return null;
	}

	const consents: any[] = Array.isArray(list?.consents) ? list.consents : [];
	if (consents.length === 0) {
		logger.info('findReusableConsent: /my/consents returned no consents');
		return null;
	}

	const now = new Date();
	const reasons: string[] = [];

	for (const c of consents) {
		const cid = String(c.consent_id ?? 'unknown').slice(0, 8);

		if (c.consumer_id !== opeyConsumerId) {
			reasons.push(`${cid}: wrong consumer_id (${String(c.consumer_id ?? '').slice(0, 8)})`);
			continue;
		}
		if (c.status !== 'ACCEPTED') {
			reasons.push(`${cid}: status=${c.status}`);
			continue;
		}
		if (!c.jwt_expires_at) {
			reasons.push(`${cid}: no jwt_expires_at field`);
			continue;
		}
		if (new Date(c.jwt_expires_at) < now) {
			reasons.push(`${cid}: expired at ${c.jwt_expires_at}`);
			continue;
		}

		// jwt_payload is a JSON string in the listing — parse it.
		let payload: any;
		try {
			payload =
				typeof c.jwt_payload === 'string' ? JSON.parse(c.jwt_payload) : c.jwt_payload;
		} catch {
			reasons.push(`${cid}: jwt_payload JSON.parse failed`);
			continue;
		}

		const existingEntitlements: any[] = Array.isArray(payload?.entitlements)
			? payload.entitlements
			: [];
		const existingViews: any[] = Array.isArray(payload?.views) ? payload.views : [];

		const entitlementsOk = requiredEntitlements.every((req) =>
			existingEntitlements.some(
				(e: any) =>
					typeof e === 'object' &&
					e?.role_name === req.role_name &&
					(e?.bank_id ?? '') === (req.bank_id ?? '')
			)
		);
		if (!entitlementsOk) {
			reasons.push(
				`${cid}: entitlements mismatch — existing=${JSON.stringify(existingEntitlements)}`
			);
			continue;
		}

		const viewsOk = requiredViews.every((req) =>
			existingViews.some(
				(v: any) =>
					typeof v === 'object' &&
					v?.bank_id === req.bank_id &&
					v?.account_id === req.account_id &&
					v?.view_id === req.view_id
			)
		);
		if (!viewsOk) {
			reasons.push(`${cid}: views mismatch — existing=${JSON.stringify(existingViews)}`);
			continue;
		}

		logger.info(
			`findReusableConsent: ✓ reusing consent ${c.consent_id} — covers ${requiredEntitlements.length} role(s) and ${requiredViews.length} view(s).`
		);
		return { consent_id: c.consent_id, jwt: c.jwt, status: c.status };
	}

	logger.info(
		`findReusableConsent: ✗ no reusable consent found among ${consents.length} candidates. Rejection reasons:\n  ${reasons.join('\n  ')}`
	);
	return null;
}
