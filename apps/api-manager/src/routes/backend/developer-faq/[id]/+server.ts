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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { FAQ_DATA_PATH, toFaqRecord, toFaqBody, validateFaqBody } from "$lib/server/developerFaq/faqEntity";

const logger = createLogger("DeveloperFaqItemAPI");

function tokenOr401(locals: App.Locals): string | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return token;
}

/** PUT /backend/developer-faq/ID -> replace a question. */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;
  let raw: any;
  try { raw = await request.json(); } catch { return json({ message: "Body must be JSON", code: 400 }, { status: 400 }); }
  const body = toFaqBody(raw);
  const invalid = validateFaqBody(body);
  if (invalid) return json({ message: invalid, code: 400 }, { status: 400 });
  try {
    const updated = await obp_requests.put(`${FAQ_DATA_PATH}/${encodeURIComponent(params.id)}`, body, token);
    return json({ item: toFaqRecord(updated) });
  } catch (e) {
    logger.error(`Failed to update FAQ item ${params.id}:`, e);
    const { body: err, status } = obpErrorResponse(e);
    return json(err, { status });
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;
  try {
    await obp_requests.delete(`${FAQ_DATA_PATH}/${encodeURIComponent(params.id)}`, token);
    return json({ deleted: params.id });
  } catch (e) {
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
