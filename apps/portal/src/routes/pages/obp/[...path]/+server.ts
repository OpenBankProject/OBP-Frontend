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
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { createObpProxyHandler } from '@obp/shared/server/obp';

/**
 * OBP proxy for published Apps (/pages/SLUG, kind app). Like /proxy/obp/..., but visitors
 * without a session are let through with no Authorization header, so an App on a public
 * page can read OBP's public endpoints (banks, products) while a logged-in visitor's own
 * access still applies. The App itself never holds a token: it runs in a sandboxed iframe
 * and only talks to this route through the page's bridge.
 */
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL, { allowAnonymous: true });

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
