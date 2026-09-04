import PORTAL_PAGE from "$lib/data/portalPageEntity.json";
import { ensureSystemDynamicEntity, recordsFromListResponse as recordsFromList, slugify as slugifyShared } from "$lib/server/dynamicEntities/ensure";

export const PORTAL_PAGE_ENTITY = PORTAL_PAGE.entity_name; // "obp_portal_page"
export const PORTAL_PAGE_DATA_PATH = `/obp/dynamic-entity/${PORTAL_PAGE_ENTITY}`;
export const PORTAL_PAGE_ID_FIELD = `${PORTAL_PAGE_ENTITY}_id`;

/** Ensure the obp_portal_page system dynamic entity exists (created at startup with application access). */
export function createPortalPageDynamicEntityIfNeeded(): Promise<boolean> {
  return ensureSystemDynamicEntity(PORTAL_PAGE);
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

export const recordsFromListResponse = recordsFromList;

export const slugify = slugifyShared;

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
