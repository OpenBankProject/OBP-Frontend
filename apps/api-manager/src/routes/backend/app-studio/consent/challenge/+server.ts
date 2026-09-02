import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("AppStudioConsentChallengeAPI");

/**
 * POST /backend/app-studio/consent/challenge  { consent_id, bank_id, answer }
 *
 * Second step of creating a consent in App Studio. Unless the consumer pair is on
 * OBP's skip-SCA list, a new consent is INITIATED and OBP sends the user a code by
 * their implicit SCA method (email or SMS). Answering it moves the consent to ACCEPTED.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Body must be JSON", code: 400 }, { status: 400 });
  }
  const consentId = String(body?.consent_id ?? "").trim();
  const bankId = String(body?.bank_id ?? "").trim();
  const answer = String(body?.answer ?? "").trim();
  if (!consentId || !bankId || !answer) {
    return json({ message: "consent_id, bank_id and answer are required", code: 400 }, { status: 400 });
  }

  try {
    const result = await obp_requests.post(
      `/obp/v3.1.0/banks/${encodeURIComponent(bankId)}/consents/${encodeURIComponent(consentId)}/challenge`,
      { answer },
      token,
    );
    logger.info(`App Studio consent ${consentId} challenge answered: ${result?.status}`);
    return json({ consent_id: result.consent_id, consent_jwt: result.jwt, status: result.status });
  } catch (e) {
    logger.error(`Failed to answer challenge for consent ${consentId}:`, e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
