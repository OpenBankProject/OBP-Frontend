import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { PORTAL_PAGE_DATA_PATH, toPortalPageRecord, normalisePageBody } from "$lib/server/portalPages/portalPageEntity";

const logger = createLogger("AppStudioPageAPI");

function auth(locals: App.Locals): { token: string; username: string } | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return { token, username: session.data.user.username ?? "" };
}

/** GET /backend/app-studio/pages/ID -> one page with its source. */
export const GET: RequestHandler = async ({ locals, params }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    const raw = await obp_requests.get(`${PORTAL_PAGE_DATA_PATH}/${encodeURIComponent(params.id)}`, a.token);
    return json({ page: toPortalPageRecord(raw) });
  } catch (e) {
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/** PUT /backend/app-studio/pages/ID -> replace the page (save, publish, unpublish). */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
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
    const updated = await obp_requests.put(`${PORTAL_PAGE_DATA_PATH}/${encodeURIComponent(params.id)}`, normalised.data, a.token);
    const record = toPortalPageRecord(updated);
    logger.info(`Portal page updated: ${record.id} (${record.kind} "${record.slug}", ${record.status})`);
    return json({ page: record });
  } catch (e) {
    logger.error(`Failed to update portal page ${params.id}:`, e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/** DELETE /backend/app-studio/pages/ID */
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    await obp_requests.delete(`${PORTAL_PAGE_DATA_PATH}/${encodeURIComponent(params.id)}`, a.token);
    logger.info(`Portal page deleted: ${params.id}`);
    return json({ deleted: params.id });
  } catch (e) {
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
