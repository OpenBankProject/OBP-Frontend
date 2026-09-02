import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";
import { expandLiveTags, stripActiveContent } from "@obp/shared/landing";
import { buildLandingFetchers } from "$lib/server/landing/fetchers";

const logger = createLogger("AppStudioExpandAPI");
const MAX_SOURCE_BYTES = 200_000;

/**
 * POST /backend/app-studio/expand  { html }  ->  { html }
 *
 * Renders a landing page source for the App Studio preview: live-data tags are
 * expanded with the catalogue (via the user's token), then all active content
 * is stripped so the result can be shown inline. Nothing is stored.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) {
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  let html: unknown;
  try {
    ({ html } = await request.json());
  } catch {
    return json({ message: "Body must be JSON with an html field", code: 400 }, { status: 400 });
  }
  if (typeof html !== "string") {
    return json({ message: "html must be a string", code: 400 }, { status: 400 });
  }
  if (html.length > MAX_SOURCE_BYTES) {
    return json({ message: `html is larger than ${MAX_SOURCE_BYTES} characters`, code: 413 }, { status: 413 });
  }

  const fetchers = buildLandingFetchers(token, {
    portalUrl: String(publicEnv.PUBLIC_PORTAL_URL ?? "").replace(/\/$/, ""),
    explorerUrl: String(env.API_EXPLORER_URL ?? "").replace(/\/$/, "").replace(/\/\?.*$/, ""),
  });

  try {
    const expanded = await expandLiveTags(html, fetchers, { onError: "show" });
    return json({ html: stripActiveContent(expanded) });
  } catch (e) {
    logger.error("Expand failed:", e);
    return json({ message: e instanceof Error ? e.message : "Expand failed", code: 500 }, { status: 500 });
  }
};
