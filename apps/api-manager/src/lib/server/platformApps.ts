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
import { renderMarkdown } from "@obp/shared/markdown";
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl, fetchGlossary, findGlossaryItem, glossaryEntryUrl } from "$lib/server/glossaryCache";

/** One declared Scope of a Platform App, and whether its Consumer holds it. */
export interface PlatformAppScope {
  role_name: string;
  bank_id: string;
  needed_for: string;
  optional: boolean;
  held: boolean;
}

/** A Platform App as GET /obp/v7.0.0/management/platform-apps returns it. */
export interface PlatformApp {
  consumer_id: string;
  consumer_name: string;
  label: string;
  marked_by_user_id: string;
  marked_at: string;
  declared_at?: string;
  version?: string;
  state: "ok" | "missing" | "not_declared";
  required_scopes: PlatformAppScope[];
}

export async function fetchPlatformApps(accessToken: string): Promise<{ apps: PlatformApp[]; error?: string }> {
  try {
    const response = await obp_requests.get("/obp/v7.0.0/management/platform-apps", accessToken);
    return { apps: response?.platform_apps ?? [] };
  } catch (e) {
    return { apps: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export const PLATFORM_APPS_GLOSSARY_TITLE = "Platform Apps";

/** The Platform Apps glossary entry, as HTML, or a warning. */
export async function platformAppsGlossary(accessToken: string, force: boolean): Promise<{ html: string | null; url: string; warning?: string }> {
  const explorerUrl = apiExplorerBaseUrl();
  const url = glossaryEntryUrl(PLATFORM_APPS_GLOSSARY_TITLE, explorerUrl);
  try {
    const item = findGlossaryItem(await fetchGlossary(accessToken, force), PLATFORM_APPS_GLOSSARY_TITLE);
    if (!item) return { html: null, url, warning: `This OBP instance has no glossary entry "${PLATFORM_APPS_GLOSSARY_TITLE}".` };
    // The entry opens with its own "# Platform Apps" heading; the page has its title already.
    const markdown = item.description.markdown.replace(/^\s*# [^\n]*\n/, "");
    // markdown-it with html:false escapes raw HTML in the source, so this is safe to {@html}.
    return { html: renderMarkdown(markdown), url };
  } catch (e) {
    return { html: null, url, warning: `Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}` };
  }
}
