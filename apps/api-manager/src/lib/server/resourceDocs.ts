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
import {
  fetchResourceDocs as fetchShared,
  getCacheStatus as sharedCacheStatus,
  preWarmResourceDocs,
} from "@obp/shared/server/explorer";
import type { ResourceDoc } from "@obp/shared/explorer";

export type { ResourceDoc };

/**
 * The Manager's view of the shared resource docs cache.
 *
 * The cache itself lives in @obp/shared/server/explorer so the Manager and the Portal's API
 * Explorer share one implementation. This binds the two things that are the Manager's
 * choice — the OBP client and the catalogue version it pins — so call sites stay one-liners
 * and only one file knows the version.
 */
export const MANAGER_RESOURCE_DOCS_VERSION = "v6.0.0";

export async function fetchResourceDocs(accessToken?: string, force = false): Promise<ResourceDoc[]> {
  return fetchShared(obp_requests, MANAGER_RESOURCE_DOCS_VERSION, { token: accessToken, force });
}

/** Age and size of the pinned catalogue, for pages that show cache freshness. */
export function getCacheStatus(): { count: number; ageSeconds: number | null } {
  const entry = sharedCacheStatus().find((s) => s.version === MANAGER_RESOURCE_DOCS_VERSION);
  return { count: entry?.count ?? 0, ageSeconds: entry?.ageSeconds ?? null };
}

/** Fill the cache in the background on login; failures are logged, never thrown. */
export function preWarmCache(accessToken?: string): void {
  preWarmResourceDocs(obp_requests, MANAGER_RESOURCE_DOCS_VERSION, { token: accessToken });
}
