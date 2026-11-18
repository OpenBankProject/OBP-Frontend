/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { env } from '$env/dynamic/private';
import { DefaultOBPIntegrationService } from '@obp/shared/server/obp';
import { createOpeyProxyHandlers } from '@obp/shared/server/opey';
import { obpRequests } from './obp';
import { conformanceOpeyPrompt } from './opeyGuide';

/**
 * Conformator's Opey proxy: every Opey call from the browser goes through these handlers (see
 * @obp/shared/server/opey). Only logged-in Users may chat: Opey is on staff pages, and acts through a consent the User
 * holds, so it reads no more than they may. Conversations are not recorded. Every message carries the tool's own focus
 * for Opey (OPEY_APP_SUPPLEMENTARY_PROMPT, then where the tool's data is and how a test is written), set here on the
 * server.
 */
export const opeyProxy = createOpeyProxyHandlers({
	opeyBaseUrl: () => env.OPEY_BASE_URL,
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token,
	requireUser: true,
	appSupplementaryPrompt: conformanceOpeyPrompt
});

/** Opey's consent for the logged-in User, created when they first chat. */
export const opeyIntegration = new DefaultOBPIntegrationService(env.OPEY_CONSUMER_ID ?? '', obpRequests);

/** What a page needs to show Opey, or null when Opey is not set up (OPEY_BASE_URL is unset). */
export function opeySettings(publicBaseUrl: string | undefined): { baseUrl: string } | null {
	return env.OPEY_BASE_URL ? { baseUrl: publicBaseUrl ?? '' } : null;
}
