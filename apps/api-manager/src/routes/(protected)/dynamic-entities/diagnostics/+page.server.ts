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

const logger = createLogger("DynamicEntityDiagnosticsPageServer");

interface EntityDiagnostic {
  dynamic_entity_id: string;
  entityName: string;
  recordCount: number;
  error?: string;
  schema?: any;
  responseKeys?: string[];
  triedKeys?: string[];
  rawResponse?: any;
}

export const load: PageServerLoad = async ({ locals }) => {
  logger.info("=== Dynamic Entity Diagnostics Page Load Started ===");

  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session");
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available");
    throw error(401, "No API access token available");
  }

  // Get user entitlements from session for role checking
  const userEntitlements =
    (session.data.user as any)?.entitlements?.list || [];

  // Check if user has system-level read role
  const hasSystemRole = userEntitlements.some(
    (ent: any) => ent.role_name === "CanGetSystemLevelDynamicEntities"
  );

  if (!hasSystemRole) {
    logger.info("User lacks CanGetSystemLevelDynamicEntities role, skipping system entities fetch");
    return {
      diagnostics: [],
      totalEntities: 0,
      totalRecords: 0,
      orphanedEntities: [],
      userEntitlements,
    };
  }

  logger.info("Access token present, fetching dynamic entities");

  try {
    const endpoint = "/obp/v6.0.0/management/system-dynamic-entities";
    logger.info(`Making API request to: ${endpoint}`);

    const entitiesResponse = await obp_requests.get(endpoint, accessToken);
    const entities = entitiesResponse.dynamic_entities || [];
    logger.info(`Found ${entities.length} dynamic entities`);

    // For each entity, fetch the record count
    const diagnostics: EntityDiagnostic[] = [];

    for (const entity of entities) {
      // In v6.0.0, the entity name is in the entity_name field
      const entityName = entity.entity_name || "Unknown";
      const schema = entity.schema;

      logger.info(
        `Checking entity: ${entityName} (ID: ${entity.dynamic_entity_id})`,
      );

      // v6.0.0 API MUST provide record_count in the entity definition
      if (entity.record_count === undefined) {
        logger.error(`  *** ERROR: record_count missing for ${entityName} ***`);
        throw new Error(
          `API v6.0.0 must provide record_count for entity ${entityName}`,
        );
      }

      const recordCount = entity.record_count;
      logger.info(
        `  Using record_count from entity definition: ${recordCount}`,
      );

      // Still fetch raw response for debugging purposes
      let fetchError: string | undefined;
      let responseKeys: string[] = [];
      let triedKeys: string[] = [];
      let rawResponse: any = undefined;

      try {
        const dataEndpoint = `/obp/dynamic-entity/${entityName}`;
        logger.info(`  Fetching raw response from: ${dataEndpoint}`);

        const dataResponse = await obp_requests.get(dataEndpoint, accessToken);
        rawResponse = dataResponse;
        responseKeys = Object.keys(dataResponse || {});
        logger.info(`  Response keys:`, responseKeys);
      } catch (err: any) {
        logger.warn(
          `  Could not fetch raw response for ${entityName}:`,
          err?.message,
        );
        // Don't set fetchError - we already have the count from the entity definition
      }

      diagnostics.push({
        dynamic_entity_id: entity.dynamic_entity_id,
        entityName,
        recordCount,
        error: fetchError,
        schema,
        responseKeys,
        triedKeys,
        rawResponse,
      });
    }

    logger.info(
      `=== Diagnostics completed for ${diagnostics.length} entities ===`,
    );

    // Sort by entity name
    diagnostics.sort((a, b) => a.entityName.localeCompare(b.entityName));

    // Fetch orphaned entities from the diagnostics endpoint
    let orphanedEntities: any[] = [];
    try {
      const diagEndpoint = "/obp/v6.0.0/management/diagnostics/dynamic-entities";
      logger.info(`Fetching orphaned entities from: ${diagEndpoint}`);
      const diagResponse = await obp_requests.get(diagEndpoint, accessToken);
      orphanedEntities = diagResponse.orphaned_entities || [];
      logger.info(`Found ${orphanedEntities.length} orphaned entities`);
    } catch (err: any) {
      logger.warn("Could not fetch orphaned entities:", err?.message);
    }

    return {
      diagnostics,
      totalEntities: diagnostics.length,
      totalRecords: diagnostics.reduce((sum, d) => sum + d.recordCount, 0),
      orphanedEntities,
      userEntitlements,
    };
  } catch (err: any) {
    logger.error("Error in diagnostics:", err);
    logger.error("Error details:", {
      message: err?.message,
      status: err?.status,
      statusText: err?.statusText,
    });

    throw error(
      500,
      err instanceof Error
        ? err.message
        : "Failed to fetch dynamic entity diagnostics",
    );
  }
};
