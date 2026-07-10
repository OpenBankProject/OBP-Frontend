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
