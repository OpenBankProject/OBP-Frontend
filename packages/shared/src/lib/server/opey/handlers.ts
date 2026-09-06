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
import { extractUsernameFromJWT } from '../../utils/jwt.js';
import { obpErrorResponse } from '../../obp/errors.js';
import type { OBPConsent } from '../../obp/types.js';

const logger = createLogger('OpeyAuthHandler');

export interface OpeyAuthHandlerConfig {
	/** Base URL of the Opey service, e.g. 'http://localhost:5000' */
	opeyBaseUrl: string;
	/** OBP consumer ID registered for Opey. If unset, the handler always returns an anonymous session. */
	opeyConsumerId?: string;
	/** Extract the OAuth access token from the SvelteKit RequestEvent */
	getAccessToken: (event: any) => string | undefined;
	/** Extract the portal session (svelte-kit-sessions) from the RequestEvent */
	getSession: (event: any) => any;
	/** Return the Consent used to authenticate the user with Opey. Called only when both a session and opeyConsumerId are present. */
	getOrCreateOpeyConsent?: (session: any) => Promise<OBPConsent>;
}

export function createOpeyAuthHandler(config: OpeyAuthHandlerConfig): {
	POST: RequestHandler;
} {
	const { opeyBaseUrl, opeyConsumerId, getAccessToken, getSession, getOrCreateOpeyConsent } = config;

	async function getAnonymousSession(warningMessage?: string) {
		logger.info(
			`Creating anonymous Opey session - Making request to ${opeyBaseUrl}/create-session (no consent JWT)`
		);

		const opeyResponse = await fetch(`${opeyBaseUrl}/create-session`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		if (!opeyResponse.ok) {
			const errorText = await opeyResponse.text();
			logger.error(`Failed to create anonymous Opey session - Error: ${errorText}`);
			throw new Error(`Failed to create anonymous Opey session: ${errorText}`);
		}

		logger.info('Successfully created anonymous Opey session');

		const setCookieHeaders = opeyResponse.headers.get('set-cookie');
		const responseData: Record<string, unknown> = { success: true, authenticated: false };
		if (warningMessage) {
			responseData.message = warningMessage;
		}

		return json(
			responseData,
			setCookieHeaders ? { headers: { 'Set-Cookie': setCookieHeaders } } : {}
		);
	}

	async function getAuthenticatedSession(portalSession: any) {
		if (!getOrCreateOpeyConsent) {
			throw new Error('getOrCreateOpeyConsent is required for authenticated Opey sessions');
		}

		const consent = await getOrCreateOpeyConsent(portalSession);
		const consentId = consent.consent_id;

		const userIdentifier = extractUsernameFromJWT(consent.jwt);
		logger.info(
			`Sending Consent-Id to Opey - Making request to ${opeyBaseUrl}/create-session - Primary user: ${userIdentifier}`
		);

		// Consent only — deliberately NO Authorization header. The consent carries the
		// user identity and scope (roles/views/TTL, consumer via its aud); handing Opey
		// the user's full-power access token alongside it made the consent ceremony
		// decorative (Opey preferred the bearer at every branch). Opey authenticates
		// itself to MCP servers with its own client-credentials token.
		// See OBP-Frontend/for_team_opey_mcp_auth_contract.md.
		const opeyResponse = await fetch(`${opeyBaseUrl}/create-session`, {
			method: 'POST',
			headers: {
				'Consent-Id': consentId,
				'Content-Type': 'application/json'
			}
		});

		if (!opeyResponse.ok) {
			const errorText = await opeyResponse.text();
			logger.error(
				`Failed to create authenticated Opey session - Primary user: ${userIdentifier} - Error: ${errorText}`
			);
			throw new Error(`Failed to create authenticated Opey session: ${errorText}`);
		}

		logger.info(
			`Successfully created authenticated Opey session - Primary user: ${userIdentifier}`
		);

		const setCookieHeaders = opeyResponse.headers.get('set-cookie');
		return json(
			{ success: true, authenticated: true },
			setCookieHeaders ? { headers: { 'Set-Cookie': setCookieHeaders } } : {}
		);
	}

	const POST: RequestHandler = async (event) => {
		try {
			const accessToken = getAccessToken(event);

			if (!accessToken) {
				return await getAnonymousSession();
			}

			if (!opeyConsumerId) {
				logger.warn('Opey consumer ID not configured, returning anonymous session');
				return await getAnonymousSession(
					'Opey consumer ID not configured, returning anonymous session instead.'
				);
			}

			const portalSession = getSession(event);
			try {
				return await getAuthenticatedSession(portalSession);
			} catch (error: unknown) {
				logger.info('JWT expired for Opey session - user needs to re-authenticate:', error);
				const { body, status } = obpErrorResponse(error);
				return json(body, { status });
			}
		} catch (error: unknown) {
			logger.error('Opey Auth error:', error);
			const { body, status } = obpErrorResponse(error);
			return json(body, { status });
		}
	};

	return { POST };
}
