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
import { getAppDirectory } from "$lib/obp/appDirectory";

/** Where the published pages are shown: the Portal and Cohort, as OBP-API's app directory advertises them. */
export const load: PageServerLoad = async () => {
  const directory = await getAppDirectory();
  return {
    siteUrls: {
      portal: directory.public_obp_portal_url || "",
      cohort: directory.public_obp_cohort_url || "",
    } as Record<string, string>,
  };
};
