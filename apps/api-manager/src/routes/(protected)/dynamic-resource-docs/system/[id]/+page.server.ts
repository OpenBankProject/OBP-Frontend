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
import { createLogger } from '@obp/shared/utils';
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl } from "$lib/server/glossaryCache";
import { env as publicEnv } from "$env/dynamic/public";

const logger = createLogger("SystemDynamicResourceDocDetailPageServer");

/**
 * OBP lists Dynamic Resource Docs under this pseudo version (OBPdynamic-entity holds only the Dynamic
 * Entity endpoints), and the API Explorer shows them there too. Reading it here, uncached, is a live
 * check that OBP's own resource-doc cache was invalidated after a create/update/delete.
 */
const EXPLORER_DYNAMIC_VERSION = "OBPdynamic-endpoint";

/** Where OBP serves a Dynamic Resource Doc, before its resource doc names the path itself. */
const SERVED_PREFIX = "/obp/dynamic-endpoint/dynamic-resource-doc";
const DYNAMIC_RESOURCE_DOCS_PATH = `/obp/v7.0.0/resource-docs/${EXPLORER_DYNAMIC_VERSION}/obp?content=dynamic`;

export interface DynamicResourceDocStatus {
  found: boolean;
  /** The full URL the endpoint is served at: OBP's base URL plus specified_url, or the path OBP serves it at. */
  servedUrl: string;
  /** The same, without OBP's base URL. */
  servedPath: string;
  explorerUrl: string | null;
  error?: string;
}

/** Find this doc's entry in OBP's dynamic resource docs by verb and URL (exact first, then suffix). */
async function lookupResourceDoc(doc: any, accessToken: string): Promise<DynamicResourceDocStatus> {
  const explorer = apiExplorerBaseUrl();
  const obpBaseUrl = (publicEnv.PUBLIC_OBP_BASE_URL ?? "").replace(/\/$/, "");
  const servedUrl = (path: string) => `${obpBaseUrl}${path}`;
  const base: DynamicResourceDocStatus = {
    found: false,
    servedUrl: servedUrl(`${SERVED_PREFIX}${doc.request_url ?? ""}`),
    servedPath: `${SERVED_PREFIX}${doc.request_url ?? ""}`,
    explorerUrl: null,
  };
  try {
    const resp = await obp_requests.get(DYNAMIC_RESOURCE_DOCS_PATH, accessToken);
    const docs: any[] = resp?.resource_docs ?? [];
    const verb = String(doc.request_verb ?? "").toUpperCase();
    const url = String(doc.request_url ?? "");
    const sameVerb = docs.filter((d) => String(d.request_verb).toUpperCase() === verb);
    const match =
      sameVerb.find((d) => d.request_url === url) ??
      sameVerb.find((d) => String(d.specified_url ?? "").endsWith(url) || String(d.request_url ?? "").endsWith(url));
    return {
      ...base,
      found: !!match,
      servedUrl: match?.specified_url ? servedUrl(match.specified_url) : base.servedUrl,
      servedPath: match?.specified_url ?? base.servedPath,
      explorerUrl: match ? `${explorer}/resource-docs/${EXPLORER_DYNAMIC_VERSION}?operationid=${encodeURIComponent(match.operation_id)}` : null,
    };
  } catch (e) {
    logger.warn("Could not read the dynamic resource docs from OBP:", e);
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;
  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  const { id } = params;
  if (!id) {
    throw error(400, "Resource doc ID is required");
  }

  try {
    const doc = await obp_requests.get(
      `/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(id)}`,
      accessToken,
    );
    if (!doc) {
      throw error(404, "Dynamic resource doc not found");
    }
    logger.debug(`Retrieved dynamic resource doc ${id}`);
    const resourceDoc = await lookupResourceDoc(doc, accessToken);
    return { doc, resourceDoc };
  } catch (err: any) {
    logger.error("Error fetching dynamic resource doc:", err);
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(
      500,
      err instanceof Error ? err.message : "Failed to fetch dynamic resource doc",
    );
  }
};
