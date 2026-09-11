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
import { renderMarkdown } from "@obp/shared/markdown";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { fetchResourceDocs } from "$lib/server/resourceDocs";
import { fetchGlossary, findGlossaryItem, rewriteGlossaryLinks, glossaryEntryUrl, apiExplorerBaseUrl } from "$lib/server/glossaryCache";

const logger = createLogger("JsonSchemaValidationsHelp");
const GLOSSARY_TITLE = "JSON Schema Validation";
const TAG = "JSON-Schema-Validation";

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const explorerUrl = apiExplorerBaseUrl();
  const warnings: string[] = [];

  let glossaryHtml: string | null = null;
  try {
    const item = findGlossaryItem(await fetchGlossary(token, force), GLOSSARY_TITLE);
    if (item) glossaryHtml = renderMarkdown(rewriteGlossaryLinks(item.description.markdown, explorerUrl));
    else warnings.push(`This OBP instance has no glossary entry "${GLOSSARY_TITLE}".`);
  } catch (e) {
    logger.warn("Could not load the OBP glossary:", e);
    warnings.push(`Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  let endpoints: { operation_id: string; request_verb: string; request_url: string; summary: string; roles: string[]; explorerUrl: string }[] = [];
  try {
    const docs = await fetchResourceDocs(token, force);
    endpoints = docs
      .filter((d) => (d.tags ?? []).includes(TAG))
      .map((d) => ({
        operation_id: d.operation_id,
        request_verb: d.request_verb,
        request_url: d.request_url,
        summary: d.summary,
        roles: (d.roles ?? []).map((r) => r.role),
        explorerUrl: `${explorerUrl}/resource-docs/OBPv6.0.0?operationid=${d.operation_id}`,
      }))
      .sort((a, b) => a.request_url.localeCompare(b.request_url) || a.request_verb.localeCompare(b.request_verb));
  } catch (e) {
    logger.warn("Could not load resource docs:", e);
    warnings.push(`Could not load the resource docs from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    glossary: { title: GLOSSARY_TITLE, html: glossaryHtml, explorerUrl: glossaryEntryUrl(GLOSSARY_TITLE, explorerUrl) },
    endpoints,
    tag: TAG,
    explorerUrl,
    warnings,
  };
};
