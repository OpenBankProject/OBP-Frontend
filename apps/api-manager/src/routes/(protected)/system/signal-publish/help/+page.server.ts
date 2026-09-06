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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { resourceDocsCache } from "$lib/stores/resourceDocsCache.svelte";
import { createLogger } from "@obp/shared/utils";
import { renderMarkdown } from "@obp/shared/markdown";
import {
  fetchGlossary,
  findGlossaryItem,
  rewriteGlossaryLinks,
  glossaryEntryUrl,
  apiExplorerBaseUrl,
} from "$lib/server/glossaryCache";

const logger = createLogger("SignalPublishHelp");

/** The OBP resource-doc tag every signal endpoint carries (ApiTag.apiTagSignalChannel). */
const SIGNAL_TAG = "Signal-Channel";
/** The glossary entry that is the explanatory text of this page. */
const GLOSSARY_TITLE = "Signal Channels";

export interface SignalEndpointDoc {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
  roles: string[];
  tags: string[];
  example_request_body: unknown;
  success_response_body: unknown;
}

const VERB_ORDER: Record<string, number> = { POST: 0, GET: 1, PUT: 2, DELETE: 3 };

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const explorerUrl = apiExplorerBaseUrl();
  const warnings: string[] = [];
  let endpoints: SignalEndpointDoc[] = [];

  let glossaryHtml: string | null = null;
  try {
    const item = findGlossaryItem(await fetchGlossary(token, force), GLOSSARY_TITLE);
    if (item) {
      // markdown-it with its default html:false escapes raw HTML in the source, so this is safe to {@html}.
      glossaryHtml = renderMarkdown(rewriteGlossaryLinks(item.description.markdown, explorerUrl));
    } else {
      warnings.push(`This OBP instance has no glossary entry "${GLOSSARY_TITLE}".`);
    }
  } catch (e) {
    logger.warn("Could not load the OBP glossary:", e);
    warnings.push(`Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    // One fetch of the v6.0.0 resource docs serves every page for 30 minutes.
    const docs = await resourceDocsCache.fetchResourceDocs(token, force);
    endpoints = docs
      .filter((doc) => (doc.tags ?? []).includes(SIGNAL_TAG))
      .map((doc) => ({
        operation_id: doc.operation_id,
        request_verb: doc.request_verb,
        request_url: doc.request_url,
        summary: doc.summary,
        roles: (doc.roles ?? []).map((r) => r.role),
        tags: doc.tags ?? [],
        example_request_body: doc.example_request_body ?? null,
        success_response_body: doc.success_response_body ?? null,
      }))
      .sort((a, b) => {
        const byUrl = a.request_url.localeCompare(b.request_url);
        return byUrl !== 0 ? byUrl : (VERB_ORDER[a.request_verb] ?? 9) - (VERB_ORDER[b.request_verb] ?? 9);
      });
    if (endpoints.length === 0) {
      warnings.push(`The resource docs from OBP contain no endpoints tagged "${SIGNAL_TAG}".`);
    }
  } catch (e) {
    logger.warn("Could not load resource docs for the Signal tag:", e);
    warnings.push(`Could not load the resource docs from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  const status = resourceDocsCache.getCacheStatus();
  return {
    endpoints,
    glossary: { title: GLOSSARY_TITLE, html: glossaryHtml, explorerUrl: glossaryEntryUrl(GLOSSARY_TITLE, explorerUrl) },
    explorerUrl,
    signalTag: SIGNAL_TAG,
    cache: { ageSeconds: status.ageSeconds, totalDocs: status.count },
    warnings,
  };
};
