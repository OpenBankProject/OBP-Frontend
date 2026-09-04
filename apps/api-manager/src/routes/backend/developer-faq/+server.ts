import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { FAQ_DATA_PATH, recordsFromListResponse, toFaqRecord, toFaqBody, validateFaqBody } from "$lib/server/developerFaq/faqEntity";

const logger = createLogger("DeveloperFaqAPI");

function tokenOr401(locals: App.Locals): string | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return token;
}

/** GET /backend/developer-faq -> every question, ordered by category then sort_order. */
export const GET: RequestHandler = async ({ locals }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;
  try {
    const response = await obp_requests.get(FAQ_DATA_PATH, token);
    const items = recordsFromListResponse(response).map(toFaqRecord)
      .sort((a, b) => a.category.localeCompare(b.category) || a.sort_order - b.sort_order || a.question.localeCompare(b.question));
    return json({ items });
  } catch (e) {
    logger.error("Failed to list FAQ:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/** POST /backend/developer-faq -> add a question. */
export const POST: RequestHandler = async ({ locals, request }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;
  let raw: any;
  try { raw = await request.json(); } catch { return json({ message: "Body must be JSON", code: 400 }, { status: 400 }); }
  const body = toFaqBody(raw);
  const invalid = validateFaqBody(body);
  if (invalid) return json({ message: invalid, code: 400 }, { status: 400 });
  try {
    const created = await obp_requests.post(FAQ_DATA_PATH, body, token);
    return json({ item: toFaqRecord(created) });
  } catch (e) {
    logger.error("Failed to create FAQ item:", e);
    const { body: err, status } = obpErrorResponse(e);
    return json(err, { status });
  }
};
