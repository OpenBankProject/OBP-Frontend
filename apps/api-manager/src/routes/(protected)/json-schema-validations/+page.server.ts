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
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { loadOperationChoices } from "$lib/server/operationChoices";
import type { JsonSchemaValidation, OperationChoice } from "$lib/services/jsonSchemaValidations";

const logger = createLogger("JsonSchemaValidationsPage");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  let validations: JsonSchemaValidation[] = [];
  let loadError: string | null = null;
  try {
    const resp = await obp_requests.get("/obp/v4.0.0/management/json-schema-validations", token);
    validations = resp?.json_schema_validations ?? [];
  } catch (e) {
    logger.error("Could not load JSON Schema Validations:", e);
    loadError = e instanceof Error ? e.message : String(e);
  }
  // Summaries for the operation ids, from the shared resource-docs cache. Best effort.
  let choices: OperationChoice[] = [];
  try {
    choices = await loadOperationChoices(token);
  } catch (e) {
    logger.warn("Could not load resource docs for operation summaries:", e);
  }
  const byId = new Map(choices.map((c) => [c.operation_id, c]));
  const rows = validations
    .map((v) => ({ ...v, endpoint: byId.get(v.operation_id) ?? null }))
    .sort((a, b) => a.operation_id.localeCompare(b.operation_id));
  return { rows, loadError };
};
