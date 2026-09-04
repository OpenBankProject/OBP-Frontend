import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { REPORT_DATA_PATH, toReportRecord, normaliseReportBody } from "$lib/server/reports/reportEntity";

const logger = createLogger("ReportAPI");

function auth(locals: App.Locals): { token: string; username: string } | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return { token, username: session.data.user.username ?? "" };
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    const raw = await obp_requests.get(`${REPORT_DATA_PATH}/${encodeURIComponent(params.id)}`, a.token);
    return json({ report: toReportRecord(raw) });
  } catch (e) {
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
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
    const updated = await obp_requests.put(`${REPORT_DATA_PATH}/${encodeURIComponent(params.id)}`, normalised.data, a.token);
    const record = toReportRecord(updated);
    logger.info(`Report updated: ${record.id} (${record.slug})`);
    return json({ report: record });
  } catch (e) {
    logger.error(`Failed to update report ${params.id}:`, e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const a = auth(locals);
  if (a instanceof Response) return a;
  try {
    await obp_requests.delete(`${REPORT_DATA_PATH}/${encodeURIComponent(params.id)}`, a.token);
    logger.info(`Report deleted: ${params.id}`);
    return json({ deleted: params.id });
  } catch (e) {
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
