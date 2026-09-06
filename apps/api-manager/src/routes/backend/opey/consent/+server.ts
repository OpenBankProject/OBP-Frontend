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
import { obp_requests } from '$lib/obp/requests';
import { obpErrorResponse } from '$lib/obp/errors';
import { createOpeyConsentHandler } from '@obp/shared/server/opey';

/**
 * POST /backend/opey/consent — mints a per-tool-call consent at OBP for Opey.
 * Shared implementation (@obp/shared/server/opey); this app supplies its request helper
 * and consumer id and keeps the default one-hour lifetime.
 */
export const { POST } = createOpeyConsentHandler({
	obpRequests: obp_requests,
	opeyConsumerId: () => env.OPEY_CONSUMER_ID,
	obpErrorResponse
});
