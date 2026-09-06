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
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/public";
import { createObpProxyHandler } from "@obp/shared/server/obp";

/**
 * App Studio consent proxy: like /proxy/obp/..., but the OBP call is made with a
 * consent instead of the user's bearer token. The studio page sends the consent
 * JWT and the key of the consumer the consent was issued to as request headers;
 * both stay in the studio page and never reach the app in the sandbox.
 */
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL, {
  authHeaders: (event) => {
    const jwt = event.request.headers.get("x-app-studio-consent-jwt");
    const consumerKey = event.request.headers.get("x-app-studio-consumer-key");
    if (!jwt || !consumerKey) return null;
    return { "Consent-JWT": jwt, "Consumer-Key": consumerKey };
  },
});

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
