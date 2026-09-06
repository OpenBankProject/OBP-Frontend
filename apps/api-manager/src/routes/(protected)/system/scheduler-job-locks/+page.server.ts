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
import { error } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";
import type { OBPSchedulerJob, OBPSchedulerJobsResponse } from "$lib/obp/types";

const logger = createLogger("SchedulerJobLocksServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, "No API access token available");
  }

  const userEntitlements =
    (session.data.user as any)?.entitlements?.list || [];

  const hasRole = userEntitlements.some(
    (ent: any) => ent.role_name === "CanGetSchedulerJobLocks",
  );

  // Don't call the API if the user can't read it — show the role alert instead.
  if (!hasRole) {
    return { hasRole, jobs: [] as OBPSchedulerJob[] };
  }

  let jobs: OBPSchedulerJob[] = [];

  try {
    const response: OBPSchedulerJobsResponse = await obp_requests.get(
      "/obp/v7.0.0/management/system/scheduler/job-locks",
      token,
    );
    jobs = response?.jobs ?? [];
    logger.debug(`Retrieved ${jobs.length} scheduler job-lock row(s)`);
  } catch (e) {
    logger.error("Error fetching scheduler job-locks:", e);
    error(500, {
      message:
        "Could not fetch scheduler job-locks at this time. Please try again later.",
    });
  }

  return { hasRole, jobs };
};
