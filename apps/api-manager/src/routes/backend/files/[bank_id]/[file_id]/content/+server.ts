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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { fileContentPath } from "$lib/server/files";

/*
 * A file's content, passed through from OBP-API with the session's token. The generic /proxy/obp route
 * reads responses as text, which would spoil a file's bytes, so file content has its own route. OBP's
 * headers are kept, including nosniff and the sandbox Content-Security-Policy that stop a file running
 * as a page of this site.
 */
const PASSED_HEADERS = ["content-type", "content-disposition", "etag", "cache-control", "x-content-type-options", "content-security-policy", "correlation-id"];

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    return new Response(JSON.stringify({ message: "Unauthorized", code: 401 }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const accessToken = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!accessToken) {
    return new Response(JSON.stringify({ message: "No API access token available", code: 401 }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const inline = url.searchParams.get("inline") === "true" ? "?inline=true" : "";
  const response = await fetch(`${env.PUBLIC_OBP_BASE_URL}${fileContentPath(params.bank_id, params.file_id)}${inline}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const headers = new Headers();
  for (const name of PASSED_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
};
