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
import { createLogger } from '$lib/utils/logger';
const logger = createLogger('LayoutServer');
import type { RequestEvent } from "@sveltejs/kit";
import { DefaultOBPIntegrationService } from '$lib/server/obp/OBPIntegrationService';
import { createOBPRequests } from '$lib/obp/requests';
import type { OBPConsentInfo } from '$lib/obp/types';

import { env } from "$env/dynamic/private";
import { env as publicEnv } from '$env/dynamic/public';

export interface RootLayoutData {
    userId?: string;
    email?: string;
    username?: string;
    opeyConsentInfo?: OBPConsentInfo;
    externalLinks: Record<string, string>;
}

export async function load(event: RequestEvent) {
	const { session } = event.locals;

	let data: Partial<RootLayoutData> = {};

	let externalLinks = {
		API_EXPLORER_URL: env.API_EXPLORER_URL,
		API_MANAGER_URL: env.API_MANAGER_URL,
		SANDBOX_POPULATOR_URL: env.SANDBOX_POPULATOR_URL,
		SUBSCRIPTIONS_URL: publicEnv.PUBLIC_SUBSCRIPTIONS_URL,
		LEGACY_PORTAL_URL: publicEnv.PUBLIC_LEGACY_PORTAL_URL
	};

	// Filter out undefined/null values and warn about missing ones
	const validExternalLinks: Record<string, string> = {};
	Object.entries(externalLinks).forEach(([name, url]) => {
		if (!url) {
			logger.warn(`Environment variable ${name} is not set, it will not show up in the menu.`);
		} else {
			validExternalLinks[name] = url;
		}
	});

	// Get information about the user from the session if they are logged in
    if (session?.data?.user) {
        data.userId = session.data.user.user_id;
        data.email = session.data.user.email;
        data.username = session.data.user.username;
    }

	// Get Opey consent info if we have Opey consumer ID configured
	if (env.OPEY_CONSUMER_ID && publicEnv.PUBLIC_OBP_BASE_URL) {
		try {
			const obpRequests = createOBPRequests(publicEnv.PUBLIC_OBP_BASE_URL);
			const obpIntegrationService = new DefaultOBPIntegrationService(env.OPEY_CONSUMER_ID, obpRequests);
			const currentConsentInfo = await obpIntegrationService.getCurrentConsentInfo(session)
			if (currentConsentInfo) {
				data.opeyConsentInfo = currentConsentInfo;
			}
		} catch (error) {
			logger.error('Error fetching Opey consent info:', error);
		}
	}

	return {
		...data,
		externalLinks: validExternalLinks
	} as RootLayoutData
}
