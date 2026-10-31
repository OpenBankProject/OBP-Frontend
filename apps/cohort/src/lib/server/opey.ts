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
import { env } from '$env/dynamic/private';
import { DefaultOBPIntegrationService } from '@obp/shared/server/obp';
import { createOpeyProxyHandlers } from '@obp/shared/server/opey';
import { OPEY_CONVERSATION } from './entities/definitions';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

/**
 * Cohort's Opey proxy: every Opey call from the browser goes through these handlers (see @obp/shared/server/opey).
 * Visitors who are not logged in chat anonymously; a logged-in User's Opey acts through a consent they hold.
 * A logged-in User's conversations are recorded into cohort_opey_conversation in Cohort's space, as that User.
 */
export const opeyProxy = createOpeyProxyHandlers({
	opeyBaseUrl: () => env.OPEY_BASE_URL,
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token,
	recording: {
		entityName: OPEY_CONVERSATION,
		obpRequests,
		bankId: cohortSpace()
	}
});

/** Opey's consent for the logged-in User, created when they first chat. */
export const opeyIntegration = new DefaultOBPIntegrationService(env.OPEY_CONSUMER_ID ?? '', obpRequests);
