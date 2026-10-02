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
 * The Manager's server-side caches of OBP content expire on their own; when the Manager
 * itself writes to OBP through its proxy, the caches that write makes stale are cleared
 * straight away so the next page load shows the change.
 */

import { createLogger } from "@obp/shared/utils";
import { clearGlossaryCache as clearApiGlossaryCache } from "@obp/shared/server/explorer";
import { clearGlossaryCache } from "$lib/server/glossaryCache";

const logger = createLogger("ClearCachesAfterWrite");

/** OBP paths (as the proxy sees them, with or without the leading `obp/`) and the caches a write to them makes stale. */
const RULES: { path: RegExp; name: string; clear: () => void }[] = [
  {
    // Glossary Items: POST /api/glossary, PUT and DELETE /api/glossary/TITLE
    path: /^(?:obp\/)?v\d+\.\d+\.\d+\/api\/glossary(?:\/|$)/,
    name: "glossary",
    clear: () => {
      clearGlossaryCache();
      clearApiGlossaryCache();
    },
  },
];

/** Call after the proxy has forwarded a request; reads never clear anything. */
export function clearCachesAfterWrite(method: string, obpPath: string, ok: boolean): void {
  if (!ok || method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  for (const rule of RULES) {
    if (rule.path.test(obpPath)) {
      rule.clear();
      logger.info(`${method} /${obpPath}: cleared the ${rule.name} cache`);
    }
  }
}
