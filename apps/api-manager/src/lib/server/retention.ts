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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { loadBankIds } from "$lib/server/domainApis";
import { retentionSpace } from "$lib/services/retention";

/** The logged-in User's OBP-API token, for the retention pages' calls (each made with the User's own Roles). */
export function retentionToken(locals: App.Locals): string {
  if (!locals.session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(locals.session)?.accessToken;
  if (!token) throw error(401, "No API access token available");
  return token;
}

/** The space from ?bank_id= (SYS when none), and the banks for the space picker. */
export async function retentionSpaces(url: URL, token: string): Promise<{ bankId: string; bankIds: string[] }> {
  const bankIds = await loadBankIds(token).catch(() => [] as string[]);
  return { bankId: retentionSpace(url.searchParams.get("bank_id")), bankIds };
}

/** OBP-API's message for a refused call. */
export const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
