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
import { retentionPath, type RetentionArchiveEntry } from "$lib/services/retention";

/** One archived copy, read-only: its JSON as it was when archived. A file's bytes download separately. */
export const load: PageServerLoad = async ({ locals, params }) => {
  const token = retentionToken(locals);
  let entry: RetentionArchiveEntry;
  try {
    entry = await obp_requests.get(retentionPath(params.bank_id, `retention-archive/${encodeURIComponent(params.archive_id)}`), token);
  } catch (e) {
    throw error(404, messageOf(e));
  }
  return { bankId: params.bank_id, bankIds: await loadBankIds(token).catch(() => [] as string[]), entry };
};
