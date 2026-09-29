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
import { obp_requests } from '$lib/obp/requests';
import { getOpeyConsentTtlSeconds } from '$lib/server/userPreferences';

/**
 * Opey's consent for the logged-in User. Shared implementation; the Portal asks for the lifetime the
 * User chose (an OBP personal data field), falling back to OPEY_CONSENT_TTL_SECONDS, then 7 days.
 */
export const obpIntegrationService = new DefaultOBPIntegrationService(
	env.OPEY_CONSUMER_ID ?? '',
	obp_requests,
	(accessToken) => getOpeyConsentTtlSeconds(accessToken, Number(env.OPEY_CONSENT_TTL_SECONDS))
);
