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
import { ROOT_CHAIN_PATH, ROOT_CHAIN_ROLES, type AuditChain } from "$lib/services/dynamicEntityAuditChains";
import { rootChainExplorerEndpoints } from "$lib/server/dynamicEntityAuditChains";

const logger = createLogger("DynamicEntityAuditChainsPage");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const entitlements: any[] = (session.data.user as any)?.entitlements?.list ?? [];
  const holds = (role: string) => entitlements.some((entitlement) => entitlement.role_name === role);
  const canGet = holds(ROOT_CHAIN_ROLES.get);
  const canSeal = holds(ROOT_CHAIN_ROLES.seal);

  // The root chain is created when the first entity's chain is started, so until then there is none to show.
  let rootChain: AuditChain | null = null;
  let loadError: string | null = null;
  if (canGet) {
    try {
      rootChain = await obp_requests.get(ROOT_CHAIN_PATH, token);
    } catch (e: any) {
      if (e?.statusCode !== 404) {
        logger.error("load says: could not load the root audit chain:", e);
        loadError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return { rootChain, canGet, canSeal, loadError, endpoints: rootChainExplorerEndpoints() };
};
