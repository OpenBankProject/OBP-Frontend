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
import PORTAL_PAGE from "$lib/data/portalPageEntity.json";
import { PAGE_SITES, sitePageOf, type SitePage } from "@obp/shared/landing";
import { ensureSystemDynamicEntity, recordsFromListResponse as recordsFromList, slugify as slugifyShared } from "$lib/server/dynamicEntities/ensure";

export const PORTAL_PAGE_ENTITY = PORTAL_PAGE.entity_name; // "obp_portal_page"
export const PORTAL_PAGE_DATA_PATH = `/obp/dynamic-entity/${PORTAL_PAGE_ENTITY}`;
export const PORTAL_PAGE_ID_FIELD = `${PORTAL_PAGE_ENTITY}_id`;

/** Ensure the obp_portal_page system dynamic entity exists (created at startup with application access). */
export function createPortalPageDynamicEntityIfNeeded(): Promise<boolean> {
  return ensureSystemDynamicEntity(PORTAL_PAGE);
}

/** A saved page as the studio sees it. */
export type PortalPageRecord = SitePage;

/** OBP wraps a single record as `{ obp_portal_page: {...} }` and lists as `{ obp_portal_page_list: [...] }`. */
export const toPortalPageRecord = (input: any): PortalPageRecord => sitePageOf(input);

export const recordsFromListResponse = recordsFromList;

export const slugify = slugifyShared;

/** Validate and normalise a page body from the studio. */
export function normalisePageBody(body: any, username: string): { ok: true; data: Record<string, string | number> } | { ok: false; message: string } {
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
  const requested: string[] = (Array.isArray(body?.sites) ? body.sites : String(body?.sites ?? "").split(",")).map((x: unknown) => String(x).trim().toLowerCase());
  const unknownSite = requested.find((x) => x && !(PAGE_SITES as readonly string[]).includes(x));
  if (unknownSite) return { ok: false, message: `unknown site ${unknownSite}; sites are ${PAGE_SITES.join(", ")}` };
  const sites = PAGE_SITES.filter((x) => requested.includes(x));
  if (status === "published" && sites.length === 0) return { ok: false, message: "choose at least one site to publish to" };
  const lang = String(body?.lang ?? "").trim().toLowerCase();
  if (lang && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(lang)) return { ok: false, message: "lang must be a language code such as en or ar, or empty" };
  const position = String(body?.menu_position ?? "").trim();
  if (position && !/^-?\d{1,6}$/.test(position)) return { ok: false, message: "menu_position must be a whole number, or empty" };
  const data: Record<string, string | number> = { slug, title, kind, status, summary, source, sites: sites.join(","), lang, author: username, updated_at: new Date().toISOString().split(".")[0] + "Z" };
  if (position) data.menu_position = Number(position);
  return { ok: true, data };
}
