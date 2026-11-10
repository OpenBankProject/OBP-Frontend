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
import { consumerScopesCheck } from "$lib/server/consumerScopes";

/**
 * What the API Manager needs from OBP-API, from its last Consumer Scopes check: its consumer_id, what OBP said to its
 * Platform App declaration, and each Scope it needs, held or not. Marking and granting happen on /consumers/platform-apps.
 */
export const load: PageServerLoad = async () => {
  const report = consumerScopesCheck.getReport();
  return {
    consumerId: consumerScopesCheck.getConsumerId() ?? null,
    declaration: consumerScopesCheck.getDeclaration(),
    checkedAt: report?.checked_at ?? null,
    state: report?.state ?? "unknown",
    problem: report?.problem ?? null,
    scopes: (report?.scopes ?? []).map((s) => ({
      role_name: s.role_name,
      bank_id: s.bank_id,
      needed_for: s.needed_for,
      optional: s.optional ?? false,
      held: s.held === true,
    })),
  };
};
