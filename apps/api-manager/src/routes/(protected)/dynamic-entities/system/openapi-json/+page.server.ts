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

const logger = createLogger("OpenAPIJSONPageServer");

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
    logger.info("=== FETCHING DYNAMIC ENTITY OPENAPI JSON ===");
    let apiUrl = `${OBP_API_URL}/resource-docs/OBPv6.0.0/openapi?content=dynamic`;
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
        `Failed to fetch OpenAPI JSON: ${response.statusText}`,
      );
    }

    const openApiJsonText = await response.text();
    logger.info("OpenAPI JSON fetched successfully");

    // Parse and format the JSON for better readability
    let openApiJson;
    try {
      const parsed = JSON.parse(openApiJsonText);
      openApiJson = JSON.stringify(parsed, null, 2);
    } catch (parseError) {
      // If parsing fails, return the original text
      logger.warn("Failed to parse JSON, returning raw text");
      openApiJson = openApiJsonText;
    }

    return {
      openApiJson,
      tags: tags || null,
      characterCount: openApiJson.length,
      apiUrl: apiUrl,
    };
  } catch (err) {
    logger.error("Error fetching OpenAPI JSON:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error ? err.message : "Failed to fetch OpenAPI JSON",
    );
  }
};
