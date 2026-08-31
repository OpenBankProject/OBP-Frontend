import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { OBPRequestError } from "$lib/obp/errors";

const logger = createLogger("DashboardNewUsersServer");

const PAGE_LIMIT = 200;
const MAX_PAGES = 5;

interface UserRow {
  user_id: string;
  username: string;
  email: string;
  provider: string;
  created_date: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const accessToken = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  const fromParam = url.searchParams.get("from_date");
  const toParam = url.searchParams.get("to_date");
  const fromMs = fromParam === null ? NaN : Date.parse(fromParam);
  const toMs = toParam === null ? NaN : Date.parse(toParam);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return {
      window: null,
      users: [] as UserRow[],
      truncated: false,
      fetchError: null as { httpStatus: number | null; message: string } | null,
    };
  }

  try {
    // GET /users has no date filter, so page newest-first on created_date until we are
    // past the window's start — the same walk the dashboard's "New users" tile does, so
    // this list and the tile's count come from identical data.
    const users: UserRow[] = [];
    let truncated = false;
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) {
        truncated = true;
        break;
      }
      const query = new URLSearchParams({
        sort_by: "created_date",
        sort_direction: "desc",
        limit: String(PAGE_LIMIT),
        offset: String(page * PAGE_LIMIT),
      });
      const body = await obp_requests.get(`/obp/v6.0.0/users?${query.toString()}`, accessToken);
      if (!Array.isArray(body?.users)) {
        throw new Error(`Unexpected users response shape: ${JSON.stringify(body).slice(0, 500)}`);
      }
      users.push(...body.users);
      if (body.users.length < PAGE_LIMIT) break;
      const oldestOnPage = Date.parse(body.users[body.users.length - 1].created_date);
      if (Number.isFinite(oldestOnPage) && oldestOnPage < fromMs) break;
    }

    // Same half-open boundary as the dashboard tile: from < created_date <= to.
    const inWindow = users.filter((user) => {
      const created = Date.parse(user.created_date);
      return Number.isFinite(created) && created > fromMs && created <= toMs;
    });

    return {
      window: { from: fromParam!, to: toParam! },
      users: inWindow,
      truncated,
      fetchError: null as { httpStatus: number | null; message: string } | null,
    };
  } catch (err) {
    logger.error("users fetch failed:", err);
    // Repo rule: never hide or simplify OBP error messages.
    const httpStatus = err instanceof OBPRequestError ? (err.statusCode ?? null) : null;
    return {
      window: { from: fromParam!, to: toParam! },
      users: [] as UserRow[],
      truncated: false,
      fetchError: {
        httpStatus,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
};
