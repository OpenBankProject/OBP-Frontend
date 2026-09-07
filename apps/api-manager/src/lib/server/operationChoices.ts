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
import { resourceDocsCache } from "$lib/stores/resourceDocsCache.svelte";
import type { OperationChoice } from "$lib/services/jsonSchemaValidations";

const BODY_VERBS = new Set(["POST", "PUT", "PATCH"]);

/**
 * Endpoints an operator can attach a request-body rule to, from the shared resource-docs cache.
 * Endpoints with a request body come first; the rest follow so any operation_id can still be chosen.
 */
export async function loadOperationChoices(accessToken: string): Promise<OperationChoice[]> {
  const docs = await resourceDocsCache.fetchResourceDocs(accessToken);
  return docs
    .map<OperationChoice>((d) => ({
      operation_id: d.operation_id,
      request_verb: d.request_verb,
      request_url: d.request_url,
      summary: d.summary,
    }))
    .sort((a, b) => {
      const ab = BODY_VERBS.has(a.request_verb) ? 0 : 1;
      const bb = BODY_VERBS.has(b.request_verb) ? 0 : 1;
      return ab - bb || a.operation_id.localeCompare(b.operation_id);
    });
}

export function choiceFor(choices: OperationChoice[], operationId: string): OperationChoice | undefined {
  return choices.find((c) => c.operation_id === operationId);
}
