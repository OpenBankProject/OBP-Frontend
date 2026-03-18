import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OpeyConsentAPI');
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { obpRequests } from '../../../../hooks.server';
import { env } from '$env/dynamic/private';
import { deduplicateRoles, pickConsentRole } from '$lib/opey/utils/roles';

/**
 * POST /api/opey/consent
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
			return json({ error: 'Authentication required to create consent' }, { status: 401 });
		}

		const body = await event.request.json();
		const { required_roles, bank_id } = body;
		const normalizedRequiredRoles = required_roles == null ? [] : required_roles;

		logger.info(`Consent request received:`, { required_roles, bank_id });

		if (!Array.isArray(normalizedRequiredRoles)) {
			logger.warn('Invalid required_roles:', required_roles);
			return json({ error: 'required_roles must be an array when provided' }, { status: 400 });
		}

		const opeyConsumerId = env.OPEY_CONSUMER_ID;
		if (!opeyConsumerId) {
			logger.error('OPEY_CONSUMER_ID not configured');
			return json({ error: 'Server configuration error: OPEY_CONSUMER_ID not set' }, { status: 500 });
		}

		// First, get the user's current roles to check what they have access to
		logger.info('Fetching user entitlements to check available roles...');
		const userEntitlements = await obpRequests.get('/obp/v5.1.0/my/entitlements', accessToken);
		const userRoleNames: string[] = (userEntitlements.list || []).map((e: any) => e.role_name);
		const userRolesSet = new Set(userRoleNames);
		logger.info(`User has ${userRoleNames.length} roles:`, userRoleNames);

		// Collapse any role that is superseded by another role already in the list
		const deduped = deduplicateRoles(normalizedRequiredRoles);
		logger.info(`Deduplicated required roles: ${deduped.join(', ')}`);

		// For each deduplicated role, pick the best role the user actually holds
		const pickedRoles: string[] = [];
		const unsatisfiable: string[] = [];
		for (const requiredRole of deduped) {
			const picked = pickConsentRole(requiredRole, userRolesSet);
			if (picked === null) {
				unsatisfiable.push(requiredRole);
			} else {
				pickedRoles.push(picked);
			}
		}

		if (unsatisfiable.length > 0) {
			logger.error(`User cannot satisfy roles:`, unsatisfiable);
			logger.error(`User has roles:`, userRoleNames);
			return json({
				error: `You don't have the required roles. Missing: ${unsatisfiable.join(', ')}. You have: ${userRoleNames.join(', ')}`
			}, { status: 403 });
		}

		logger.info(`Using picked roles for consent JWT: ${pickedRoles.join(', ')}`);

		// Build entitlements array from the picked roles (not the raw required list)
		const entitlements = pickedRoles.map((roleName: string) => ({
			role_name: roleName,
			bank_id: bank_id || ''
		}));

		const now = new Date().toISOString().split('.')[0] + 'Z';

		const consentBody = {
			everything: false,
			entitlements,
			consumer_id: opeyConsumerId,
			views: [],
			valid_from: now,
			time_to_live: 3600 // 1 hour
		};

		logger.info(`Creating role-specific consent with ${pickedRoles.length} roles: ${pickedRoles.join(', ')}`);
		logger.info(`Consent body:`, JSON.stringify(consentBody, null, 2));

		const consent = await obpRequests.post(
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
	} catch (error: any) {
		logger.error('Failed to create consent:', error);
		const message = error?.message || 'Failed to create consent';
		const status = error?.code || 500;
		return json({ error: message }, { status: typeof status === 'number' ? status : 500 });
	}
}
