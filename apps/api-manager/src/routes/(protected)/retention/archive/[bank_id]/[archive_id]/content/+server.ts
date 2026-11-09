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
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { messageOf, retentionToken } from "$lib/server/retention";
import { retentionPath, type RetentionArchiveEntry } from "$lib/services/retention";

/** An archived file's bytes, as a download, read with the archive Role. */
export const GET: RequestHandler = async ({ locals, params }) => {
  const token = retentionToken(locals);
  let entry: RetentionArchiveEntry;
  try {
    entry = await obp_requests.get(retentionPath(params.bank_id, `retention-archive/${encodeURIComponent(params.archive_id)}`, { include_content: true }), token);
  } catch (e) {
    throw error(404, messageOf(e));
  }
  if (!entry.content_base64) throw error(404, "This archive entry has no content.");
  const data = (entry.data ?? {}) as Record<string, unknown>;
  const name = String(data.file_name ?? `${entry.resource_id}.bin`).replace(/["\\\r\n]/g, "_");
  return new Response(Buffer.from(entry.content_base64, "base64"), {
    headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"` },
  });
};
