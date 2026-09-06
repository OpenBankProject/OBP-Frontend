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
import { obp_requests } from "$lib/obp/requests";
import { getApplicationAccessToken } from "$lib/server/oauth/applicationToken";
import { ensureSystemDynamicEntity as ensureShared } from "@obp/shared/server/obp";
import type { SystemDynamicEntityDefinition } from "@obp/shared/server/obp";

export type { SystemDynamicEntityDefinition };

/**
 * Ensure a system-level dynamic entity exists in OBP, creating it at startup with the API
 * Manager's application token; an existing entity whose auth_mode or schema properties fall
 * behind the definition is updated. One implementation for every app: @obp/shared/server/obp.
 */
export async function ensureSystemDynamicEntity(definition: SystemDynamicEntityDefinition): Promise<boolean> {
  const accessToken = await getApplicationAccessToken();
  return ensureShared(definition, {
    accessToken,
    get: (path, token) => obp_requests.get(path, token),
    post: (path, body, token) => obp_requests.post(path, body, token),
    put: (path, body, token) => obp_requests.put(path, body, token),
  });
}

/** The list endpoint answers `{ "<entity>_list": [...] }`; be tolerant about the key. */
export function recordsFromListResponse(response: any): any[] {
  if (Array.isArray(response)) return response;
  const listKey = Object.keys(response ?? {}).find((k) => Array.isArray(response[k]));
  return listKey ? response[listKey] : [];
}

/** A single record comes wrapped as `{ <entity>: {...} }`; unwrap it. */
export function unwrapRecord(entityName: string, input: any): any {
  return input?.[entityName] && typeof input[entityName] === "object" ? input[entityName] : input;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
