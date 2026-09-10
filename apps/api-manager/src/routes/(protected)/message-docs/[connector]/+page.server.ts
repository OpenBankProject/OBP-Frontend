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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import {
  loadMessageDocIndex,
  explorerMessageDocsUrl,
  isKnownConnector,
  connectorLabel,
  MESSAGE_DOC_CONNECTORS,
  type MessageDocIndexRow,
} from "$lib/server/messageDocsCache";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";
import { loadActiveConnector } from "$lib/server/activeConnector";

const logger = createLogger("MessageDocsPage");

/** The endpoints behind this page, linked to their resource docs in the API Explorer. */
const ENDPOINTS = [
  { operation_id: "OBPv2.2.0-getMessageDocs", verb: "GET", path: "/obp/v2.2.0/message-docs/CONNECTOR" },
  { operation_id: "OBPv6.0.0-getMessageDocsJsonSchema", verb: "GET", path: "/obp/v6.0.0/message-docs/CONNECTOR/json-schema" },
  { operation_id: "OBPv3.1.0-getMessageDocsSwagger", verb: "GET", path: "/obp/v3.1.0/message-docs/CONNECTOR/swagger2.0" },
];

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const connector = params.connector;
  if (!isKnownConnector(connector)) {
    throw error(404, `"${connector}" is not a connector this OBP build serves message docs for.`);
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  const force = url.searchParams.get("refresh") === "1";

  // Best effort and never fatal: the page is useful without knowing what is running.
  const activeConnector = await loadActiveConnector(token, force);

  let rows: MessageDocIndexRow[] = [];
  let total = 0;
  let duplicateProcesses: string[] = [];
  let loadError: string | null = null;
  try {
    const index = await loadMessageDocIndex(token, connector, force);
    rows = index.rows;
    duplicateProcesses = index.duplicateProcesses;
    total = rows.length;
    if (query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      rows = rows.filter((r) => terms.every((t) => `${r.process} ${r.description}`.toLowerCase().includes(t)));
    }
  } catch (e) {
    logger.error(`Could not load message docs for ${connector}:`, e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  return {
    connector,
    connectorLabel: connectorLabel(connector),
    activeConnector,
    connectors: MESSAGE_DOC_CONNECTORS.map((c) => ({ ...c })),
    rows,
    total,
    duplicateProcesses,
    query,
    loadError,
    explorerConnectorUrl: explorerMessageDocsUrl(connector),
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) })),
  };
};
