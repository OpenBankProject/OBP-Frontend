import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { env as publicEnv } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import portalPageEntity from "$lib/data/portalPageEntity.json";

const logger = createLogger("AppStudioHelp");

export interface EntityStatus {
  exists: boolean;
  dynamic_entity_id: string;
  auth_mode: string;
  record_count: number | null;
  /** True when the running OBP-API returns auth_mode on entity definitions (i.e. supports it). */
  obp_supports_auth_mode: boolean;
}

export interface ConsumerSummary {
  consumer_id: string;
  app_name: string;
  developer_email: string;
  enabled: boolean;
}

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const warnings: string[] = [];

  let entity: EntityStatus = { exists: false, dynamic_entity_id: "", auth_mode: "", record_count: null, obp_supports_auth_mode: false };
  try {
    const response = await obp_requests.get("/obp/v6.0.0/management/system-dynamic-entities", token);
    const entities: any[] = response?.dynamic_entities ?? [];
    const found = entities.find((e) => e.entity_name === portalPageEntity.entity_name);
    entity = {
      exists: !!found,
      dynamic_entity_id: found?.dynamic_entity_id ?? "",
      auth_mode: found?.auth_mode ?? (found ? "UserOnly" : ""),
      record_count: typeof found?.record_count === "number" ? found.record_count : null,
      obp_supports_auth_mode: entities.some((e) => "auth_mode" in e),
    };
  } catch (e) {
    logger.warn("Could not list system dynamic entities:", e);
    warnings.push(`Could not read the dynamic entities from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  let consumers: ConsumerSummary[] = [];
  try {
    const response = await obp_requests.get("/obp/v6.0.0/management/consumers?limit=500&offset=0&from_date=1970-01-01T00:00:00.000Z", token);
    consumers = (response?.consumers ?? []).map((c: any) => ({
      consumer_id: c.consumer_id,
      app_name: c.app_name,
      developer_email: c.developer_email,
      enabled: !!c.enabled,
    }));
  } catch (e) {
    logger.warn("Could not list consumers:", e);
    warnings.push(`Could not list consumers: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    entityName: portalPageEntity.entity_name,
    requiredAuthMode: portalPageEntity.auth_mode,
    getRole: `CanGetDynamicEntity_System${portalPageEntity.entity_name}`,
    editorRoles: ["Create", "Update", "Delete"].map((op) => `Can${op}DynamicEntity_System${portalPageEntity.entity_name}`),
    entity,
    consumers,
    portalUrl: String(publicEnv.PUBLIC_PORTAL_URL ?? "").replace(/\/$/, ""),
    warnings,
  };
};
