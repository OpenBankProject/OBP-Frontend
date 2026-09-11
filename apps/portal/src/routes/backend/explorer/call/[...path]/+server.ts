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
import { env } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import { createObpProxyHandler } from '@obp/shared/server/obp';
import { fetchApiVersions } from '@obp/shared/server/explorer';
import type { RequestHandler } from './$types';

/**
 * The API Explorer's "send this request" proxy.
 *
 * Two differences from /proxy/obp/[...path], both forced by what the Explorer documents:
 *
 *   - **Every standard, not just /obp.** The Explorer browses nine of them, so the
 *     handler is built with an empty path prefix and the full path is forwarded. To keep
 *     that from turning the Portal into an open proxy to any path on the OBP host, the
 *     first segment must be one OBP itself advertises as an API standard in
 *     /api/versions — obp, berlin-group, open-banking, stet and the rest. Nothing else
 *     is forwarded.
 *   - **Anonymous callers are allowed through.** The Explorer is public and many OBP
 *     endpoints are readable without a token, so a visitor with no session gets the
 *     request forwarded with no Authorization header and OBP applies its own anonymous
 *     rules. A logged-in visitor's bearer is attached as usual, and it never leaves the
 *     server.
 */
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL, {
	allowAnonymous: true,
	pathPrefix: ''
});

const callObp: RequestHandler = async (event) => {
	const firstSegment = (event.params.path ?? '').split('/')[0];
	const versions = await fetchApiVersions(obp_requests);
	const knownPrefixes = new Set(versions.map((v) => v.urlPrefix));

	if (!firstSegment || !knownPrefixes.has(firstSegment)) {
		return new Response(
			JSON.stringify({ code: 400, message: `Not an OBP API standard: ${firstSegment}` }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	return proxyRequest(event);
};

export const GET: RequestHandler = callObp;
export const POST: RequestHandler = callObp;
export const PUT: RequestHandler = callObp;
export const DELETE: RequestHandler = callObp;
export const PATCH: RequestHandler = callObp;
