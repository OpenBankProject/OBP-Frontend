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
import { OBP_API_URL } from "$lib/config";

const logger = createLogger("OpenAPIYAMLPageServer");

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;

  // Get tags parameter from URL
  const tags = url.searchParams.get("tags");

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  try {
    logger.info("=== FETCHING DYNAMIC ENTITY OPENAPI YAML ===");
    let apiUrl = `${OBP_API_URL}/resource-docs/OBPv6.0.0/openapi.yaml?content=dynamic`;
    if (tags) {
      apiUrl += `&tags=${encodeURIComponent(tags)}`;
      logger.info(`Filtering by tags: ${tags}`);
    }
    logger.info(`Request: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw error(
        response.status,
        `Failed to fetch OpenAPI YAML: ${response.statusText}`,
      );
    }

    const openApiYaml = await response.text();
    logger.info("OpenAPI YAML fetched successfully");

    return {
      openApiYaml,
      tags: tags || null,
      characterCount: openApiYaml.length,
      apiUrl: apiUrl,
    };
  } catch (err) {
    logger.error("Error fetching OpenAPI YAML:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error ? err.message : "Failed to fetch OpenAPI YAML",
    );
  }
};
