import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { PORTAL_PAGE_DATA_PATH, recordsFromListResponse, toPortalPageRecord, normalisePageBody } from "$lib/server/portalPages/portalPageEntity";

const logger = createLogger("AppStudioPagesAPI");

function auth(locals: App.Locals): { token: string; username: string } | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return { token, username: session.data.user.username ?? "" };
}

/** GET /backend/app-studio/pages -> the saved pages, without their sources. */
export const GET: RequestHandler = async ({ locals }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    const response = await obp_requests.get(PORTAL_PAGE_DATA_PATH, a.token);
    const pages = recordsFromListResponse(response)
      .map(toPortalPageRecord)
      .map(({ source, ...rest }) => ({ ...rest, source_length: source.length }))
      .sort((x, y) => (y.updated_at > x.updated_at ? 1 : -1));
    return json({ pages });
  } catch (e) {
    logger.error("Failed to list portal pages:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/** POST /backend/app-studio/pages -> create a page record. */
export const POST: RequestHandler = async ({ locals, request }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Body must be JSON", code: 400 }, { status: 400 });
  }
  const normalised = normalisePageBody(body, a.username);
  if (!normalised.ok) return json({ message: normalised.message, code: 400 }, { status: 400 });
  try {
    const created = await obp_requests.post(PORTAL_PAGE_DATA_PATH, normalised.data, a.token);
    const record = toPortalPageRecord(created);
    logger.info(`Portal page created: ${record.id} (${record.kind} "${record.slug}", ${record.status})`);
    return json({ page: record });
  } catch (e) {
    logger.error("Failed to create portal page:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
