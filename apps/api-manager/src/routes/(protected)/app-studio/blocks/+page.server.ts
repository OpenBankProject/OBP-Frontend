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
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";
import { expandLiveTags, describeLandingBlocksForOpey } from "@obp/shared/landing";
import { buildLandingFetchers, findDemoCollectionId } from "$lib/server/landing/fetchers";
import { HACKATHON_PAGE, PARTNER_PAGE } from "./examples";

const logger = createLogger("LandingBlocksDemo");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const fetchers = buildLandingFetchers(token, {
    portalUrl: String(publicEnv.PUBLIC_PORTAL_URL ?? "").replace(/\/$/, ""),
    explorerUrl: String(env.API_EXPLORER_URL ?? "").replace(/\/$/, "").replace(/\/\?.*$/, ""),
  });

  // The examples reference a collection; use the first catalogue product that has one.
  let collectionId = "";
  try {
    collectionId = await findDemoCollectionId(token);
    logger.info(`Landing blocks demo collection: ${collectionId || "(none)"}`);
  } catch (e) {
    logger.warn("Could not pick a demo collection:", e);
  }

  const examples = [
    { key: "hackathon", title: "Hackathon (dark, bold)", source: HACKATHON_PAGE(collectionId) },
    { key: "partner", title: "Partner programme (light, editorial)", source: PARTNER_PAGE(collectionId) },
  ];

  const expanded = await Promise.all(
    examples.map(async (ex) => ({ ...ex, html: await expandLiveTags(ex.source, fetchers, { onError: "show" }) })),
  );

  return { examples: expanded, opeyContext: describeLandingBlocksForOpey(), collectionId };
};
