import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { REPORT_DATA_PATH, recordsFromListResponse, toReportRecord, normaliseReportBody } from "$lib/server/reports/reportEntity";

const logger = createLogger("ReportsAPI");

function auth(locals: App.Locals): { token: string; username: string } | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return { token, username: session.data.user.username ?? "" };
}

/** GET /backend/reports -> saved reports without their definitions. */
export const GET: RequestHandler = async ({ locals }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    const response = await obp_requests.get(REPORT_DATA_PATH, a.token);
    const reports = recordsFromListResponse(response)
      .map(toReportRecord)
      .map(({ definition, ...rest }) => ({ ...rest, definition_length: definition.length }))
      .sort((x, y) => (y.updated_at > x.updated_at ? 1 : -1));
    return json({ reports });
  } catch (e) {
    logger.error("Failed to list reports:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/** POST /backend/reports -> create a report. */
export const POST: RequestHandler = async ({ locals, request }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Body must be JSON", code: 400 }, { status: 400 });
  }
  const normalised = normaliseReportBody(body, a.username);
  if (!normalised.ok) return json({ message: normalised.message, code: 400 }, { status: 400 });
  try {
    const created = await obp_requests.post(REPORT_DATA_PATH, normalised.data, a.token);
    const record = toReportRecord(created);
    logger.info(`Report created: ${record.id} (${record.slug})`);
    return json({ report: record });
  } catch (e) {
    logger.error("Failed to create report:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
