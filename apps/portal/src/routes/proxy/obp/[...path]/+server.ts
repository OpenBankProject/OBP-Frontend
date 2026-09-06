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

// hooks.server.ts refuses to start without PUBLIC_OBP_BASE_URL, so no fallback here.
// See docs/obp-proxy.md — implementation lives in @obp/shared (server/obp/obpProxy.ts).
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL);

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
