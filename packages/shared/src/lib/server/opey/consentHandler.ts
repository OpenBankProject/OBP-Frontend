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
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createLogger } from '../../utils/logger.js';
import { obpErrorResponse as sharedObpErrorResponse } from '../../obp/errors.js';
import { pickConsentEntitlement, selectConsentEntitlements, CONSENT_FORBIDDEN_ROLES } from '../../opey/utils/roles.js';
import { capConsentTtlSeconds } from '../obp/consentsConfig.js';
import { findReusableConsent, normalizeMyResources } from '../obp/consentReuse.js';

const logger = createLogger('OpeyConsentHandler');

/** The subset of an app's OBP request helper the consent handler needs. */
export interface OpeyConsentObpRequests {
	get(path: string, accessToken?: string): Promise<any>;
	post(path: string, body: any, accessToken?: string): Promise<any>;
}

export interface OpeyConsentHandlerConfig {
	/** The app's OBP request helper (its own base URL, logging and error mapping). */
	obpRequests: OpeyConsentObpRequests;
	/** OBP consumer id registered for Opey; read per request so env changes are seen. Unset means 500. */
	opeyConsumerId: () => string | undefined;
	/**
	 * Desired consent lifetime in seconds for the logged-in user; the handler caps it against
	 * OBP's `consents.max_time_to_live`. Default: one hour.
	 */
	desiredTtlSeconds?: (accessToken: string) => Promise<number> | number;
	/** Maps a thrown error to a response body and status. Default: the shared mapping. */
	obpErrorResponse?: (err: unknown) => { body: any; status: number };
	/** Extract the portal session (svelte-kit-sessions) from the RequestEvent. Default: event.locals.session. */
	getSession?: (event: any) => any;
}

/** The consent-minting endpoint the per-tool consent card posts to. */
export const OBP_CREATE_CONSENT_PATH = '/obp/v6.0.0/my/consents/IMPLICIT';

/**
 * Creates the `POST` handler that mints a per-tool-call consent at OBP for Opey.
 *
 * The consent card sends the roles Opey reported (`required_roles`), the bank they are
 * scoped to (`bank_id`), the account views the user picked (`views`) and the user's own
 * resources the call needs (`my_resources`). The handler:
 *  1. picks the exact stored (role_name, bank_id) pairs from the user's entitlements, or
 *     refuses with a 403 that says what is missing and how to fix it;
 *  2. reuses an unexpired consent that already covers the request;
 *  3. otherwise creates one at OBP and returns its JWT.
 * The JWT goes back to Opey through the approval endpoint and never reaches the model.
 *
 * One implementation for every app: the per-app parts (request helper, consumer id, TTL
 * preference, error mapping) come in through the config.
 */
export function createOpeyConsentHandler(config: OpeyConsentHandlerConfig): { POST: RequestHandler } {
	const {
		obpRequests,
		opeyConsumerId,
		desiredTtlSeconds = () => 3600,
		obpErrorResponse = sharedObpErrorResponse,
		getSession = (event: any) => event.locals?.session
	} = config;

	const POST: RequestHandler = async (event) => {
		try {
			const session = getSession(event);
			const hasSession = !!session;
			const hasUser = !!session?.data?.user;
			const hasOAuth = !!session?.data?.oauth;
			const accessToken: string | undefined = session?.data?.oauth?.access_token;

			if (!accessToken) {
				const reason = !hasSession
					? 'no session object'
					: !hasUser
						? 'session exists but no user data (not logged in)'
						: !hasOAuth
							? 'session has user but no OAuth data'
							: 'session has OAuth data but access_token is missing';
				logger.warn(`Consent creation failed: ${reason}`, {
					hasSession,
					hasUser,
					hasOAuth,
					sessionId: session?.id || 'none',
					username: session?.data?.user?.username || 'none'
				});
				return json({ message: 'Authentication required to create consent', code: 401 }, { status: 401 });
			}

			const body = await event.request.json();
			const { required_roles, bank_id, views: requestedViews, my_resources: requestedMyResources } = body;
			if (required_roles != null && !Array.isArray(required_roles)) {
				logger.warn('Invalid required_roles:', required_roles);
				return json({ message: 'required_roles must be an array when provided', code: 400 }, { status: 400 });
			}
			// Accept both plain role names and {role|role_name} objects (the MCP's
			// consent_required payload uses objects). A role that normalizes to nothing is a
			// bug upstream — fail loudly rather than minting a consent with fewer roles than
			// were asked for.
			const normalizedRequiredRoles: string[] = (required_roles ?? []).map((r: unknown) => {
				if (typeof r === 'string') return r;
				const obj = r as { role?: string; role_name?: string; name?: string } | null;
				return obj?.role || obj?.role_name || obj?.name || '';
			});
			if (normalizedRequiredRoles.some((r) => r === '')) {
				logger.error('required_roles contained an entry with no recognizable role name:', required_roles);
				return json({ message: 'required_roles contained an unrecognizable entry', code: 400 }, { status: 400 });
			}

			// Views the consent_request event named plus any the user picked in the Account Scope
			// panel, forwarded into the consent body so view-based endpoints can be called with the JWT.
			const normalizedViews: Array<{ bank_id: string; account_id: string; view_id: string }> =
				Array.isArray(requestedViews)
					? requestedViews.filter(
							(v: any) =>
								v && typeof v.bank_id === 'string' && typeof v.account_id === 'string' && typeof v.view_id === 'string'
						)
					: [];

			// The user's own resources the consent must list (OBP `my_resources`, v6.0.0 and later).
			// Owned, not granted: OBP checks only that each entity exists with personal endpoints, so
			// there is nothing to pre-check against entitlements here — just keep the shape honest.
			const normalizedMyResources = normalizeMyResources(requestedMyResources);
			if (normalizedMyResources === undefined && requestedMyResources != null) {
				logger.warn('Invalid my_resources:', requestedMyResources);
				return json(
					{ message: 'my_resources.personal_dynamic_entities must be a list of {bank_id, entity_name, actions}', code: 400 },
					{ status: 400 }
				);
			}

			logger.info('Consent request received:', { required_roles, bank_id, views: normalizedViews, my_resources: normalizedMyResources });

			const consumerId = opeyConsumerId();
			if (!consumerId) {
				logger.error('OPEY_CONSUMER_ID not configured');
				return json({ message: 'Server configuration error: OPEY_CONSUMER_ID not set', code: 500 }, { status: 500 });
			}

			// The user's stored entitlements are the source of truth for the (role_name, bank_id)
			// pairs a consent may carry: OBP rejects any pair that is not stored (OBP-35013).
			const userEntitlements = await obpRequests.get('/obp/v5.1.0/my/entitlements', accessToken);
			const userEntitlementList: Array<{ role_name: string; bank_id: string }> = userEntitlements.list || [];
			const userRoleNames: string[] = userEntitlementList.map((e) => e.role_name);
			logger.info(`User has ${userRoleNames.length} roles:`, userRoleNames);

			// Role catalogue: which roles are bank-scoped. Also a sanity check on stored pairs;
			// an inconsistency is logged, never blocked on.
			const availableRolesResp = await obpRequests.get('/obp/v2.1.0/roles', accessToken);
			const requiresBankIdByRole = new Map<string, boolean>(
				(availableRolesResp.roles || []).map((r: any) => [r.role, r.requires_bank_id])
			);
			for (const e of userEntitlementList) {
				const requiresBankId = requiresBankIdByRole.get(e.role_name);
				if (requiresBankId === undefined) continue;
				if (requiresBankId === false && e.bank_id !== '') {
					logger.warn(`Entitlement inconsistency: role '${e.role_name}' is system-level (requires_bank_id=false) but stored with bank_id='${e.bank_id}'.`);
				} else if (requiresBankId === true && e.bank_id === '') {
					logger.warn(`Entitlement inconsistency: role '${e.role_name}' is bank-scoped (requires_bank_id=true) but stored with empty bank_id.`);
				}
			}

			// Pick the exact stored pair for each required role. A superseding chain in the list
			// (e.g. CanCreateEntitlementAtOneBank | CanCreateEntitlementAtAnyBank) is OBP's "X or Y".
			const requestedBankId = bank_id || '';
			const { entitlements, unsatisfiable, unknown } = selectConsentEntitlements(
				normalizedRequiredRoles,
				requestedBankId,
				userEntitlementList,
				(r) => requiresBankIdByRole.get(r)
			);
			logger.info(
				`Required roles ${normalizedRequiredRoles.join(', ')} → embedding ${entitlements.map((e) => `${e.role_name}@${e.bank_id || '(system)'}`).join(', ') || 'nothing'}`
			);

			if (unsatisfiable.length > 0) {
				logger.error('User cannot satisfy roles:', unsatisfiable);
				logger.error('User has roles:', userRoleNames);
				// The bank's creator can usually fix this themself: bank creation auto-grants
				// CanCreateEntitlementAtOneBank, and that role IS allowed in a consent.
				const canSelfGrant =
					pickConsentEntitlement('CanCreateEntitlementAtOneBank', requestedBankId, userEntitlementList, (r) => requiresBankIdByRole.get(r)) !== null;
				// The system-wide granting role never goes into a consent (OBP-35033).
				const heldForbidden = userEntitlementList
					.filter((e) => CONSENT_FORBIDDEN_ROLES.includes(e.role_name))
					.map((e) => e.role_name);
				const bankSuffix = requestedBankId ? ` for bank ${requestedBankId}` : '';
				const nextStep =
					unknown.length > 0
						? `OBP has no role named ${unknown.join(', ')}. Opey asked for a role that does not exist — it should look up the endpoint's real required roles (resource docs) and retry with one of those.`
						: heldForbidden.length > 0
							? `You hold ${heldForbidden.join(', ')}, but OBP does not allow that role in a consent (OBP-35033), so Opey cannot use it. Grant yourself CanCreateEntitlementAtOneBank${bankSuffix} on the Entitlements page, then retry.`
							: canSelfGrant
								? `You hold CanCreateEntitlementAtOneBank${bankSuffix}, so you can grant it to yourself — ask Opey to add the missing entitlement${bankSuffix}, or do it on the Entitlements page, then retry.`
								: 'Ask an admin to grant the missing entitlement, then try again.';
				const message = `You don't have the required roles. Missing: ${unsatisfiable.join(', ')}. ${nextStep}`;
				// Both keys: the consent card reads `error` first and `message` second.
				return json({ error: message, message, code: 403 }, { status: 403 });
			}

			logger.info(`Using picked entitlements for consent JWT: ${entitlements.map((e) => `${e.role_name}@${e.bank_id || '(system)'}`).join(', ')}`);

			// Reuse an unexpired consent that already covers the request, so repeat actions do
			// not mint a new consent each time.
			const reusable = await findReusableConsent({
				obpGet: (p, t) => obpRequests.get(p, t),
				accessToken,
				opeyConsumerId: consumerId,
				requiredEntitlements: entitlements,
				requiredViews: normalizedViews,
				requiredMyResources: normalizedMyResources ?? null
			});
			if (reusable) {
				return json({
					consent_jwt: reusable.jwt,
					consent_id: reusable.consent_id,
					status: reusable.status,
					roles: normalizedRequiredRoles,
					reused: true
				});
			}

			const now = new Date().toISOString().split('.')[0] + 'Z';

			// The app's desired lifetime, capped against OBP's `consents.max_time_to_live`
			// (via /obp/v7.0.0/public/consent-config) to avoid OBP-35020 on creation.
			const desiredTtl = await desiredTtlSeconds(accessToken);
			const { ttl: consentTtl, max: serverMaxTtl, capped: ttlWasCapped } = await capConsentTtlSeconds(desiredTtl, (p, t) => obpRequests.get(p, t));
			if (ttlWasCapped) {
				logger.info(`Per-tool consent TTL capped to OBP max — requested ${desiredTtl}s, server max ${serverMaxTtl}s, using ${consentTtl}s`);
			}

			const consentBody = {
				everything: false,
				entitlements,
				consumer_id: consumerId,
				views: normalizedViews,
				valid_from: now,
				time_to_live: consentTtl,
				...(normalizedMyResources ? { my_resources: normalizedMyResources } : {})
			};

			logger.info(`Creating role-specific consent with ${entitlements.length} entitlement pair(s)`);
			logger.info('Consent body:', JSON.stringify(consentBody, null, 2));

			const consent = await obpRequests.post(OBP_CREATE_CONSENT_PATH, consentBody, accessToken);
			logger.info(`Consent created successfully: ${consent.consent_id}`);

			return json({
				consent_jwt: consent.jwt,
				consent_id: consent.consent_id,
				status: consent.status,
				roles: normalizedRequiredRoles
			});
		} catch (err: unknown) {
			logger.error('Failed to create consent:', err);
			const { body, status } = obpErrorResponse(err);
			return json(body, { status });
		}
	};

	return { POST };
}
