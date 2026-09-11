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
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl } from "$lib/server/glossaryCache";
import {
  MESSAGE_DOC_CONNECTORS,
  DEFAULT_CONNECTOR,
  isKnownConnector,
  connectorLabel,
  loadMessageDocIndex as loadIndexShared,
  loadMessageDoc as loadDocShared,
} from "@obp/shared/server/explorer";
import type { MessageDoc, MessageDocIndexRow } from "@obp/shared/server/explorer";

export { MESSAGE_DOC_CONNECTORS, DEFAULT_CONNECTOR, isKnownConnector, connectorLabel };
export type { MessageDoc, MessageDocIndexRow };

/**
 * The Manager's view of the shared message docs cache.
 *
 * The cache and the connector list live in @obp/shared/server/explorer so the Manager and
 * the Portal's API Explorer share one implementation; this binds the OBP client.
 */
export function loadMessageDocIndex(
  accessToken: string,
  connector: string,
  force = false,
): Promise<{ rows: MessageDocIndexRow[]; duplicateProcesses: string[] }> {
  return loadIndexShared(obp_requests, connector, { token: accessToken, force });
}

export function loadMessageDoc(
  accessToken: string,
  connector: string,
  process: string,
  force = false,
): Promise<MessageDoc | undefined> {
  return loadDocShared(obp_requests, connector, process, { token: accessToken, force });
}

/** The API Explorer's Message Docs page for a connector, optionally anchored on one process. */
export function explorerMessageDocsUrl(connector: string, process?: string): string {
  const base = `${apiExplorerBaseUrl()}/message-docs/${encodeURIComponent(connector)}`;
  return process ? `${base}#${process}` : base;
}
