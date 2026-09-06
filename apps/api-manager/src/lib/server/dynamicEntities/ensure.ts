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
