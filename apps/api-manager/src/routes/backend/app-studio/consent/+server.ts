import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { CONSENT_FORBIDDEN_ROLES } from "@obp/shared/opey";
import { capConsentTtlSeconds } from "@obp/shared/server/obp";

const logger = createLogger("AppStudioConsentAPI");
const API_VERSION = "v6.0.0";

function tokenOr401(locals: App.Locals): string | Response {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });
  return token;
}

/**
 * GET /backend/app-studio/consent
 * What the user can put into a consent: their consumers, their accounts, their roles.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;
  try {
    const [consumers, accounts, entitlements] = await Promise.all([
      obp_requests.get(`/obp/${API_VERSION}/management/users/current/consumers`, token),
      obp_requests.get(`/obp/${API_VERSION}/my/accounts`, token),
      obp_requests.get(`/obp/${API_VERSION}/my/entitlements`, token),
    ]);
    const forbidden = new Set<string>(CONSENT_FORBIDDEN_ROLES);
    return json({
      consumers: (consumers?.consumers ?? []).map((c: any) => ({
        consumer_id: c.consumer_id,
        app_name: c.app_name,
        enabled: c.enabled,
      })),
      accounts: (accounts?.accounts ?? accounts ?? []).map((a: any) => ({
        bank_id: a.bank_id,
        account_id: a.id,
        label: a.label,
      })),
      entitlements: (entitlements?.list ?? [])
        .filter((e: any) => !forbidden.has(e.role_name))
        .map((e: any) => ({ role_name: e.role_name, bank_id: e.bank_id })),
    });
  } catch (e) {
    logger.error("Failed to load consent options:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};

/**
 * POST /backend/app-studio/consent
 * { consumer_id, views: [{bank_id, account_id, view_id}], entitlements: [{bank_id, role_name}], time_to_live }
 * Creates an implicit consent for that consumer with exactly that scope and returns its JWT.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const token = tokenOr401(locals);
  if (token instanceof Response) return token;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Body must be JSON", code: 400 }, { status: 400 });
  }
  const consumerId = String(body?.consumer_id ?? "").trim();
  if (!consumerId) return json({ message: "consumer_id is required", code: 400 }, { status: 400 });

  const views = (Array.isArray(body?.views) ? body.views : [])
    .filter((v: any) => v?.bank_id && v?.account_id && v?.view_id)
    .map((v: any) => ({ bank_id: String(v.bank_id), account_id: String(v.account_id), view_id: String(v.view_id) }));
  const forbidden = new Set<string>(CONSENT_FORBIDDEN_ROLES);
  const entitlements = (Array.isArray(body?.entitlements) ? body.entitlements : [])
    .filter((e: any) => e?.role_name && !forbidden.has(e.role_name))
    .map((e: any) => ({ bank_id: String(e.bank_id ?? ""), role_name: String(e.role_name) }));

  const desiredTtl = Number.isFinite(Number(body?.time_to_live)) && Number(body.time_to_live) > 0 ? Number(body.time_to_live) : 3600;
  const { ttl } = await capConsentTtlSeconds(desiredTtl, (p, t) => obp_requests.get(p, t));

  const consentBody = {
    everything: false,
    entitlements,
    consumer_id: consumerId,
    views,
    valid_from: new Date().toISOString().split(".")[0] + "Z",
    time_to_live: ttl,
  };
  try {
    const consent = await obp_requests.post("/obp/v5.1.0/my/consents/IMPLICIT", consentBody, token);
    logger.info(`App Studio consent ${consent.consent_id} created for consumer ${consumerId}: ${views.length} view(s), ${entitlements.length} role(s), ttl ${ttl}s`);
    return json({
      consent_id: consent.consent_id,
      consent_jwt: consent.jwt,
      status: consent.status,
      views,
      entitlements,
      time_to_live: ttl,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  } catch (e) {
    logger.error("Failed to create App Studio consent:", e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
