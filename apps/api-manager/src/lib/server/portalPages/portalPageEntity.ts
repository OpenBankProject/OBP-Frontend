import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import { getApplicationAccessToken } from "$lib/server/oauth/applicationToken";
import PORTAL_PAGE from "$lib/data/portalPageEntity.json";

const logger = createLogger("PortalPageEntity");

export const PORTAL_PAGE_ENTITY = PORTAL_PAGE.entity_name; // "obp_portal_page"
export const PORTAL_PAGE_DATA_PATH = `/obp/dynamic-entity/${PORTAL_PAGE_ENTITY}`;
export const PORTAL_PAGE_ID_FIELD = `${PORTAL_PAGE_ENTITY}_id`;

/**
 * Ensure the obp_portal_page system dynamic entity exists in OBP. Runs at startup with
 * application access; a missing scope only logs a warning, the API Manager still starts.
 * Users then need CanCreate/CanGet/CanUpdateDynamicEntity_Systemobp_portal_page to save pages.
 */
export async function createPortalPageDynamicEntityIfNeeded(): Promise<boolean> {
  const accessToken = await getApplicationAccessToken();
  if (!accessToken) {
    logger.warn(`Cannot bootstrap '${PORTAL_PAGE_ENTITY}': no application access token (client_credentials).`);
    return false;
  }
  try {
    const response = await obp_requests.get("/obp/v6.0.0/management/system-dynamic-entities", accessToken);
    const existing = (response?.dynamic_entities ?? []).find((e: { entity_name: string }) => e.entity_name === PORTAL_PAGE_ENTITY);
    if (existing) {
      // The Portal reads this entity as an application (Consumer Scope), which needs auth_mode
      // UserOrApplication. An entity created before that field existed is UserOnly: upgrade it.
      const currentMode = existing.auth_mode ?? "UserOnly";
      if (currentMode !== PORTAL_PAGE.auth_mode && existing.dynamic_entity_id) {
        try {
          await obp_requests.put(`/obp/v6.0.0/management/system-dynamic-entities/${existing.dynamic_entity_id}`, PORTAL_PAGE, accessToken);
          logger.info(`Dynamic entity '${PORTAL_PAGE_ENTITY}' auth_mode updated ${currentMode} -> ${PORTAL_PAGE.auth_mode}.`);
        } catch (err) {
          logger.warn(`Dynamic entity '${PORTAL_PAGE_ENTITY}' exists with auth_mode ${currentMode}; could not update it (an OBP-API without auth_mode ignores the field): ${err}`);
        }
      } else {
        logger.info(`Dynamic entity '${PORTAL_PAGE_ENTITY}' already exists (auth_mode ${currentMode}).`);
      }
      return true;
    }
  } catch (err) {
    logger.warn(`Could not list system dynamic entities (needs CanCreateSystemLevelDynamicEntity scope): ${err}`);
    return false;
  }
  try {
    await obp_requests.post("/obp/v6.0.0/management/system-dynamic-entities", PORTAL_PAGE, accessToken);
    logger.info(`Dynamic entity '${PORTAL_PAGE_ENTITY}' created.`);
    return true;
  } catch (err) {
    logger.warn(`Failed to create dynamic entity '${PORTAL_PAGE_ENTITY}': ${err}`);
    return false;
  }
}

/** A saved page as the studio sees it. */
export interface PortalPageRecord {
  id: string;
  slug: string;
  title: string;
  kind: "page" | "app";
  status: "draft" | "published";
  summary: string;
  source: string;
  author: string;
  updated_at: string;
}

/**
 * OBP wraps a single record as `{ obp_portal_page: {...} }` (create, read one, update) and
 * lists as `{ obp_portal_page_list: [...] }`; pick out the fields we store either way.
 */
export function toPortalPageRecord(input: any): PortalPageRecord {
  const raw = input?.[PORTAL_PAGE_ENTITY] && typeof input[PORTAL_PAGE_ENTITY] === "object" ? input[PORTAL_PAGE_ENTITY] : input;
  return {
    id: String(raw?.[PORTAL_PAGE_ID_FIELD] ?? raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    title: String(raw?.title ?? ""),
    kind: raw?.kind === "app" ? "app" : "page",
    status: raw?.status === "published" ? "published" : "draft",
    summary: String(raw?.summary ?? ""),
    source: String(raw?.source ?? ""),
    author: String(raw?.author ?? ""),
    updated_at: String(raw?.updated_at ?? ""),
  };
}

/** The list endpoint answers `{ "<entity>_list": [...] }`; be tolerant about the key. */
export function recordsFromListResponse(response: any): any[] {
  if (Array.isArray(response)) return response;
  const listKey = Object.keys(response ?? {}).find((k) => Array.isArray(response[k]));
  return listKey ? response[listKey] : [];
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

/** Validate and normalise a page body from the studio. */
export function normalisePageBody(body: any, username: string): { ok: true; data: Record<string, string> } | { ok: false; message: string } {
  const title = String(body?.title ?? "").trim();
  if (!title) return { ok: false, message: "title is required" };
  const slug = slugify(String(body?.slug ?? "").trim() || title);
  if (!slug) return { ok: false, message: "slug is required" };
  const kind = body?.kind === "app" ? "app" : body?.kind === "page" ? "page" : "";
  if (!kind) return { ok: false, message: "kind must be page or app" };
  const status = body?.status === "published" ? "published" : "draft";
  const source = String(body?.source ?? "");
  if (!source.trim()) return { ok: false, message: "source is required" };
  if (source.length > 500000) return { ok: false, message: "source is larger than 500000 characters" };
  const summary = String(body?.summary ?? "").slice(0, 500);
  return {
    ok: true,
    data: { slug, title, kind, status, summary, source, author: username, updated_at: new Date().toISOString().split(".")[0] + "Z" },
  };
}
