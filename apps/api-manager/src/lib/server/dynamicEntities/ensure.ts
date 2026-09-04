import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import { getApplicationAccessToken } from "$lib/server/oauth/applicationToken";

const logger = createLogger("EnsureDynamicEntity");

export interface SystemDynamicEntityDefinition {
  entity_name: string;
  auth_mode?: string;
  [key: string]: unknown;
}

/**
 * Ensure a system-level dynamic entity exists in OBP, creating it at startup with the API
 * Manager's application token. An existing entity whose auth_mode differs from the definition
 * is updated. A missing scope only logs a warning; the API Manager still starts.
 */
export async function ensureSystemDynamicEntity(definition: SystemDynamicEntityDefinition): Promise<boolean> {
  const name = definition.entity_name;
  const accessToken = await getApplicationAccessToken();
  if (!accessToken) {
    logger.warn(`Cannot bootstrap '${name}': no application access token (client_credentials).`);
    return false;
  }
  try {
    const response = await obp_requests.get("/obp/v6.0.0/management/system-dynamic-entities", accessToken);
    const existing = (response?.dynamic_entities ?? []).find((e: { entity_name: string }) => e.entity_name === name);
    if (existing) {
      const currentMode = existing.auth_mode ?? "UserOnly";
      const wantedMode = definition.auth_mode ?? "UserOnly";
      if (currentMode !== wantedMode && existing.dynamic_entity_id) {
        try {
          await obp_requests.put(`/obp/v6.0.0/management/system-dynamic-entities/${existing.dynamic_entity_id}`, definition, accessToken);
          logger.info(`Dynamic entity '${name}' auth_mode updated ${currentMode} -> ${wantedMode}.`);
        } catch (err) {
          logger.warn(`Dynamic entity '${name}' exists with auth_mode ${currentMode}; could not update it: ${err}`);
        }
      } else {
        logger.info(`Dynamic entity '${name}' already exists (auth_mode ${currentMode}).`);
      }
      return true;
    }
  } catch (err) {
    logger.warn(`Could not list system dynamic entities (needs CanCreateSystemLevelDynamicEntity scope): ${err}`);
    return false;
  }
  try {
    await obp_requests.post("/obp/v6.0.0/management/system-dynamic-entities", definition, accessToken);
    logger.info(`Dynamic entity '${name}' created.`);
    return true;
  } catch (err) {
    logger.warn(`Failed to create dynamic entity '${name}': ${err}`);
    return false;
  }
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
