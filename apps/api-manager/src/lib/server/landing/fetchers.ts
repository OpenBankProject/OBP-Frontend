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
/**
 * The landing-page fetchers for this app: the shared implementation, bound to this app's OBP client.
 */
import { obp_requests } from "$lib/obp/requests";
import { buildLandingFetchers as buildShared, findDemoCollectionId as findShared, type LandingLinkConfig } from "@obp/shared/server/landing";
import type { LandingFetchers } from "@obp/shared/landing";

export type { LandingLinkConfig };

export function buildLandingFetchers(token: string, links: LandingLinkConfig): LandingFetchers {
  return buildShared((path, t) => obp_requests.get(path, t), token, links);
}

export async function findDemoCollectionId(token: string): Promise<string> {
  return findShared((path, t) => obp_requests.get(path, t), token);
}
