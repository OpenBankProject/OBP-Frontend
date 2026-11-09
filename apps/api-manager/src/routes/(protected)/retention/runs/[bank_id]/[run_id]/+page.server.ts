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
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { loadBankIds } from "$lib/server/domainApis";
import { messageOf, retentionToken } from "$lib/server/retention";
import { retentionPath, type RetentionRun, type RetentionRunItem } from "$lib/services/retention";

const PAGE = 200;

/** One run and its part of the disposal register: what it archived, anonymised or deleted (ids only, no content). */
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const token = retentionToken(locals);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  let run: RetentionRun;
  try {
    run = await obp_requests.get(retentionPath(params.bank_id, `retention-runs/${encodeURIComponent(params.run_id)}`), token);
  } catch (e) {
    throw error(404, messageOf(e));
  }
  const [items, bankIds] = await Promise.all([
    obp_requests.get(retentionPath(params.bank_id, `retention-runs/${encodeURIComponent(params.run_id)}/items`, { limit: PAGE, offset }), token).then((r) => (r?.retention_run_items ?? []) as RetentionRunItem[], () => [] as RetentionRunItem[]),
    loadBankIds(token).catch(() => [] as string[]),
  ]);
  return { bankId: params.bank_id, bankIds, run, items, offset, pageSize: PAGE };
};
