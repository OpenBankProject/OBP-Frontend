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
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { loadOperationChoices, choiceFor } from "$lib/server/operationChoices";
import { apiExplorerBaseUrl } from "$lib/server/glossaryCache";

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const operationId = params.operation_id;
  let validation: any;
  try {
    validation = await obp_requests.get(`/obp/v4.0.0/management/json-schema-validations/${encodeURIComponent(operationId)}`, token);
  } catch (e) {
    throw error(404, `No JSON Schema Validation for ${operationId}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const operationChoices = await loadOperationChoices(token).catch(() => []);
  const endpoint = choiceFor(operationChoices, operationId) ?? null;
  const version = operationId.match(/^(OBPv[0-9.]+)-/)?.[1] ?? "OBPv6.0.0";
  return {
    validation,
    operationChoices,
    endpoint,
    explorerUrl: `${apiExplorerBaseUrl()}/resource-docs/${version}?operationid=${encodeURIComponent(operationId)}`,
  };
};
