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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { consumerScopesCheck } from "$lib/server/consumerScopes";
import { fetchPlatformApps } from "$lib/server/platformApps";

/**
 * The Platform Apps of this installation, as OBP holds them: each app's Consumer, the Scopes the app
 * has declared it needs, and which of them the Consumer holds.
 */
export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = SessionOAuthHelper.getSessionOAuth(locals.session)?.accessToken;
  if (!accessToken) throw error(401, "No API access token available");

  const platformApps = await fetchPlatformApps(accessToken);

  // Offer to mark this API Manager's own Consumer, which it knows from its /status check.
  const ownConsumerId = consumerScopesCheck.getConsumerId() ?? "";
  const ownConsumerMarked = platformApps.apps.some((a) => a.consumer_id === ownConsumerId);

  return {
    apps: platformApps.apps,
    loadError: platformApps.error ?? null,
    ownConsumerId: ownConsumerMarked ? "" : ownConsumerId,
  };
};
