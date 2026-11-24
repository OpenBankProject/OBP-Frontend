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
import { obp_requests } from "$lib/obp/requests";
import { findDynamicEntityDefinition } from "$lib/server/dynamicEntities/definitions";
import { entityChainPath, type AuditChain, type AuditChainEntry } from "$lib/services/dynamicEntityAuditChains";
import { entityChainExplorerEndpoints } from "$lib/server/dynamicEntityAuditChains";

const logger = createLogger("DynamicEntityAuditChainPage");

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const bankId = params.bank_id;
  const dynamicEntityId = params.dynamic_entity_id;
  const entity = await findDynamicEntityDefinition(dynamicEntityId, bankId, token);
  if (!entity) throw error(404, `Dynamic Entity ${dynamicEntityId} not found in ${bankId}`);

  // Which entries to show: a page of the whole chain from from_sequence, or one record's history.
  const recordId = url.searchParams.get("record_id")?.trim() ?? "";
  const fromSequence = Math.max(0, Number.parseInt(url.searchParams.get("from_sequence") ?? "0", 10) || 0);

  // An entity without a chain answers 404, which is not an error here: the page offers to start one.
  let chain: AuditChain | null = null;
  let entries: AuditChainEntry[] = [];
  let loadError: string | null = null;
  try {
    chain = await obp_requests.get(entityChainPath(bankId, dynamicEntityId), token);
  } catch (e: any) {
    if (e?.statusCode !== 404) {
      logger.error(`load says: could not load the audit chain of ${dynamicEntityId} in ${bankId}:`, e);
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  if (chain) {
    const query = recordId
      ? `record_id=${encodeURIComponent(recordId)}`
      : `from_sequence=${fromSequence}&limit=${PAGE_SIZE}`;
    try {
      entries = (await obp_requests.get(`${entityChainPath(bankId, dynamicEntityId)}/entries?${query}`, token)).entries;
    } catch (e) {
      logger.error(`load says: could not load the audit chain entries of ${dynamicEntityId} in ${bankId}:`, e);
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    bankId,
    dynamicEntityId,
    entityName: entity.entity_name as string,
    chain,
    entries,
    recordId,
    fromSequence,
    pageSize: PAGE_SIZE,
    loadError,
    endpoints: entityChainExplorerEndpoints(),
  };
};
