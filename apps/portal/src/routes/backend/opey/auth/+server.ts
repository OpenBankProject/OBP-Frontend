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
import { createOpeyAuthHandler } from '@obp/shared/server/opey';
import { env } from '$env/dynamic/private';
import { obpIntegrationService } from '$lib/server/opey/OBPIntegrationService';

export const { POST } = createOpeyAuthHandler({
	opeyBaseUrl: env.OPEY_BASE_URL!,
	opeyConsumerId: env.OPEY_CONSUMER_ID,
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token,
	getSession: (event) => event.locals.session,
	getOrCreateOpeyConsent: (session) => obpIntegrationService.getOrCreateOpeyConsent(session)
});
