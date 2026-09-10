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
import { obp_requests } from "$lib/obp/requests";
import { fetchGlossary, findGlossaryItem, rewriteGlossaryLinks, glossaryEntryUrl, apiExplorerBaseUrl } from "$lib/server/glossaryCache";

const logger = createLogger("GlossaryItemsHelp");

/** The glossary entries this page is made of. The text lives in OBP, not here. */
const GLOSSARY_TITLES = ["Dynamic Glossary Item", "Glossary"] as const;
const TAG = "Documentation";
/** v7 is where the endpoints live; the shared resource-docs cache only holds v6. */
const DOCS_PATH = `/obp/v7.0.0/resource-docs/v7.0.0/obp?tags=${TAG}`;

export interface HelpGlossarySection {
  title: string;
  html: string | null;
  explorerUrl: string;
}

export interface GlossaryItemEndpoint {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
  roles: string[];
  explorerUrl: string;
}

const VERB_ORDER: Record<string, number> = { GET: 0, POST: 1, PUT: 2, DELETE: 3 };

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const explorerUrl = apiExplorerBaseUrl();
  const warnings: string[] = [];

  const [glossary, endpoints] = await Promise.all([
    fetchGlossary(token, force).catch((e) => {
      logger.warn("Could not load the OBP glossary:", e);
      warnings.push(`Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }),
    obp_requests
      .get(DOCS_PATH, token)
      .then((resp) =>
        ((resp?.resource_docs ?? []) as any[])
          // The Documentation tag is broad; these pages are about the /glossary-items resource.
          .filter((d) => String(d.request_url ?? "").includes("glossary-item"))
          .map<GlossaryItemEndpoint>((d) => ({
            operation_id: d.operation_id,
            request_verb: d.request_verb,
            request_url: d.request_url,
            summary: d.summary,
            roles: (d.roles ?? []).map((r: { role: string }) => r.role),
            explorerUrl: `${explorerUrl}/resource-docs/OBPv7.0.0?operationid=${d.operation_id}`,
          }))
          .sort(
            (a, b) =>
              a.request_url.localeCompare(b.request_url) ||
              (VERB_ORDER[a.request_verb] ?? 9) - (VERB_ORDER[b.request_verb] ?? 9),
          ),
      )
      .catch((e) => {
        logger.warn("Could not load the v7 glossary-item resource docs:", e);
        warnings.push(`Could not load the ${TAG} resource docs from OBP: ${e instanceof Error ? e.message : String(e)}`);
        return [] as GlossaryItemEndpoint[];
      }),
  ]);

  const sections: HelpGlossarySection[] = GLOSSARY_TITLES.map((title) => {
    const item = findGlossaryItem(glossary, title);
    if (!item) warnings.push(`This OBP instance has no glossary entry "${title}".`);
    return {
      title,
      // markdown-it with its default html:false escapes any raw HTML in the source, so this is safe to {@html}.
      html: item ? renderMarkdown(rewriteGlossaryLinks(item.description.markdown, explorerUrl)) : null,
      explorerUrl: glossaryEntryUrl(title, explorerUrl),
    };
  });

  return { sections, endpoints, tag: TAG, explorerUrl, warnings };
};
