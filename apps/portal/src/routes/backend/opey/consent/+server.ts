import { createLogger } from '@obp/shared/utils';
const logger = createLogger('OpeyConsentAPI');
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { obp_requests } from '$lib/obp/requests';
import { obpErrorResponse } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';
import { pickConsentEntitlement, selectConsentEntitlements, CONSENT_FORBIDDEN_ROLES } from '@obp/shared/opey';
import { getOpeyConsentTtlSeconds } from '$lib/server/userPreferences';
import { capConsentTtlSeconds, findReusableConsent } from '@obp/shared/server/obp';

/**
 * POST /backend/opey/consent
 * 
 * Creates a role-specific consent at OBP for a tool call that requires elevated permissions.
 * The frontend sends the required roles from the consent_request event, and this endpoint:
 * 1. Creates a consent with those specific roles via the OBP API
 * 2. Returns the Consent-JWT to the frontend
 * 
 * The frontend then sends this JWT to the Opey backend via the approval endpoint,
 * where it's injected into the tool call headers (never reaching the LLM).
 */
export async function POST(event: RequestEvent) {
	try {
		const session = event.locals.session;
		const hasSession = !!session;
		const hasUser = !!session?.data?.user;
		const hasOAuth = !!session?.data?.oauth;
		const accessToken = session?.data?.oauth?.access_token;

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
				hasAccessToken: !!accessToken,
				sessionId: session?.id || 'none',
				username: session?.data?.user?.username || 'none'
			});
			return json({ message: 'Authentication required to create consent', code: 401 }, { status: 401 });
		}

		const body = await event.request.json();
		const { required_roles, bank_id, views: requestedViews } = body;
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

		// Views the user picked in the Account Scope panel. Forwarded into the consent
		// body so view-based endpoints (e.g. /accounts/ACCOUNT_ID/views/VIEW_ID/...) can be
		// called via the resulting JWT without a separate prompt.
		const normalizedViews: Array<{ bank_id: string; account_id: string; view_id: string }> =
			Array.isArray(requestedViews)
				? requestedViews.filter(
					(v: any) =>
						v && typeof v.bank_id === 'string' && typeof v.account_id === 'string' && typeof v.view_id === 'string'
				)
				: [];

		logger.info(`Consent request received:`, { required_roles, bank_id });

		const opeyConsumerId = env.OPEY_CONSUMER_ID;
		if (!opeyConsumerId) {
			logger.error('OPEY_CONSUMER_ID not configured');
			return json({ message: 'Server configuration error: OPEY_CONSUMER_ID not set', code: 500 }, { status: 500 });
		}

		// First, get the user's current entitlements. These are the source of truth for
		// the (role_name, bank_id) pairs we can put in the Consent body — the backend
		// rejects any pair that doesn't exactly match a stored entitlement (OBP-35013).
		logger.info('Fetching user entitlements to check available roles...');

		// Debug: check which user OBP thinks we are (TEMPORARY - remove after debugging)
		logger.debug('Access token for curl testing:', accessToken);
		const currentUser = await obp_requests.get('/obp/v5.1.0/users/current', accessToken);
		logger.debug('OBP current user for this token:', JSON.stringify({ user_id: currentUser.user_id, username: currentUser.username, email: currentUser.email }));
		logger.debug('Session user:', JSON.stringify({ user_id: session?.data?.user?.user_id, username: session?.data?.user?.username }));

		const userEntitlements = await obp_requests.get('/obp/v5.1.0/my/entitlements', accessToken);
		logger.debug('Raw entitlements response:', JSON.stringify(userEntitlements));
		const userEntitlementList: Array<{ role_name: string; bank_id: string }> = userEntitlements.list || [];
		const userRoleNames: string[] = userEntitlementList.map((e) => e.role_name);
		logger.info(`User has ${userRoleNames.length} roles:`, userRoleNames);

		// Fetch the role catalogue purely as a sanity check: warn if a stored entitlement
		// disagrees with the catalogue (e.g. a system-level role stored with a non-empty
		// bank_id, or a bank-scoped role stored with an empty bank_id). Don't block on this.
		const availableRolesResp = await obp_requests.get('/obp/v2.1.0/roles', accessToken);
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

		// Pick the exact stored (role_name, bank_id) pair for each required role. OBP
		// executes the consent as a shadow user holding exactly these pairs, so a pair at
		// the wrong bank mints a consent that fails at call time with a role error —
		// refuse up front instead, naming the role AND bank that are missing. A
		// superseding chain in the list (e.g. CanCreateEntitlementAtOneBank |
		// CanCreateEntitlementAtAnyBank) is OBP's "X or Y": holding either suffices.
		const requestedBankId = bank_id || '';
		const { entitlements, unsatisfiable, unknown } = selectConsentEntitlements(
			normalizedRequiredRoles,
			requestedBankId,
			userEntitlementList,
			(r) => requiresBankIdByRole.get(r)
		);
		logger.info(`Required roles ${normalizedRequiredRoles.join(', ')} → embedding ${entitlements.map((e) => `${e.role_name}@${e.bank_id || '(system)'}`).join(', ') || 'nothing'}`);

		if (unsatisfiable.length > 0) {
			logger.error(`User cannot satisfy roles:`, unsatisfiable);
			logger.error(`User has roles:`, userRoleNames);
			// The bank's creator can usually fix this themself: bank creation auto-grants
			// CanCreateEntitlementAtOneBank, and that role IS allowed in a consent, so Opey
			// can do the grant. Say so instead of pointing at "an admin".
			const canSelfGrant =
				pickConsentEntitlement(
					'CanCreateEntitlementAtOneBank',
					requestedBankId,
					userEntitlementList,
					(r) => requiresBankIdByRole.get(r)
				) !== null;
			// Holding the system-wide granting role does not help: OBP never lets a consent
			// carry it (OBP-35033), so the user must grant themself the bank-scoped one first.
			const heldForbidden = userEntitlementList
				.filter((e) => CONSENT_FORBIDDEN_ROLES.includes(e.role_name))
				.map((e) => e.role_name);
			const nextStep = unknown.length > 0
				? `OBP has no role named ${unknown.join(', ')}. Opey asked for a role that does not exist — it should look up the endpoint's real required roles (resource docs) and retry with one of those.`
				: heldForbidden.length > 0
				? `You hold ${heldForbidden.join(', ')}, but OBP does not allow that role in a consent (OBP-35033), so Opey cannot use it. Grant yourself CanCreateEntitlementAtOneBank${requestedBankId ? ` for bank ${requestedBankId}` : ''} on the Entitlements page (/user/entitlements), then retry — Opey can use the bank-scoped role.`
				: canSelfGrant
				? `You hold CanCreateEntitlementAtOneBank${requestedBankId ? ` for bank ${requestedBankId}` : ''}, so you can grant it to yourself — ask Opey to add the missing entitlement${requestedBankId ? ` at ${requestedBankId}` : ''} (it will ask for a consent carrying that role), then retry this call.`
				: 'Ask an admin to grant the missing entitlement, then try again.';
			return json({
				message: `You don't have the required roles. Missing: ${unsatisfiable.join(', ')}. ${nextStep}`,
				code: 403
			}, { status: 403 });
		}

		logger.info(
			`Using picked entitlements for consent JWT: ${entitlements.map((e) => `${e.role_name}@${e.bank_id || '(system)'}`).join(', ')}`
		);

		// Try to reuse an existing consent that already covers this scope. Without
		// this, every consent_request from Opey mints a new consent at OBP — even
		// when an identical one already exists for the user, leading to consent
		// proliferation and "asking the same view again and again" UX.
		const reusable = await findReusableConsent({
			obpGet: (p, t) => obp_requests.get(p, t),
			accessToken,
			opeyConsumerId,
			requiredEntitlements: entitlements,
			requiredViews: normalizedViews
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

		// Per-user TTL preference (OBP personal data field) → env default → built-in 7 days,
		// then clamped against OBP's `consents.max_time_to_live` (via /obp/v7.0.0/public/consent-config)
		// to avoid OBP-35020 (consent TTL exceeds server maximum).
		const desiredTtl = await getOpeyConsentTtlSeconds(
			accessToken,
			Number(env.OPEY_CONSENT_TTL_SECONDS)
		);
		const { ttl: consentTtl, max: serverMaxTtl, capped: ttlWasCapped } = await capConsentTtlSeconds(
			desiredTtl,
			(p, t) => obp_requests.get(p, t)
		);
		if (ttlWasCapped) {
			logger.info(
				`Per-tool consent TTL capped to OBP max — requested ${desiredTtl}s, server max ${serverMaxTtl}s, using ${consentTtl}s`
			);
		}

		const consentBody = {
			everything: false,
			entitlements,
			consumer_id: opeyConsumerId,
			views: normalizedViews,
			valid_from: now,
			time_to_live: consentTtl
		};

		logger.info(`Creating role-specific consent with ${entitlements.length} entitlement pair(s)`);
		logger.info(`Consent body:`, JSON.stringify(consentBody, null, 2));

		const consent = await obp_requests.post(
			'/obp/v5.1.0/my/consents/IMPLICIT',
			consentBody,
			accessToken
		);

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
}
