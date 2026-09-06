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
import { browser } from "$app/environment";

// Import both caches
import { resourceDocsCache as serverCache } from "./resourceDocsCache.svelte";
import { resourceDocsCacheBrowser as browserCache } from "./resourceDocsCache.browser.svelte";

/**
 * Unified export that automatically uses the correct cache
 * based on the environment (browser vs server)
 */
export const resourceDocsCache = browser ? browserCache : serverCache;

// Re-export types for convenience
export type { ResourceDoc } from "./resourceDocsCache.svelte";
