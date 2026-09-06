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

const logger = createLogger("SystemDynamicEntityDetailPageServer");

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
    throw error(400, "Entity ID is required");
  }

  try {
    // Fetch all system dynamic entities
    // Fetch all system dynamic entities to get the entity definition
    const entitiesResponse = await obp_requests.get(
      "/obp/v6.0.0/management/system-dynamic-entities",
      accessToken,
    );
    const entities = entitiesResponse.dynamic_entities || [];

    // Find the specific entity by dynamic_entity_id
    const entity = entities.find((e: any) => e.dynamic_entity_id === id);

    if (!entity) {
      throw error(404, "System dynamic entity not found");
    }

    // Get user entitlements from session for role checking
    const userEntitlements =
      (session.data.user as any)?.entitlements?.list || [];

    return {
      entity,
      userEntitlements,
    };
  } catch (err) {
    logger.error("Error fetching system dynamic entity:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error
        ? err.message
        : "Failed to fetch system dynamic entity",
    );
  }
};
