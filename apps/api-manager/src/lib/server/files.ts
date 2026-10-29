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
/** Server-side helpers for the Files pages: OBP-API's v7.0.0 file endpoints. */

/** The most files OBP-API returns in one page of Get Files of a Space. */
export const FILES_PAGE_SIZE = 500;

/** `/obp/v7.0.0/banks/BANK_ID/files/FILE_ID/content` */
export function fileContentPath(bankId: string, fileId: string): string {
  return `/obp/v7.0.0/banks/${encodeURIComponent(bankId)}/files/${encodeURIComponent(fileId)}/content`;
}
