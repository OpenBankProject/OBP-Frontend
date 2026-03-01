import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("UserPreferencesAPI");

// GET: Fetch all personal data fields
export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching preferences");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  try {
    const endpoint = `/obp/v6.0.0/my/personal-data-fields`;
    const response = await obp_requests.get(endpoint, accessToken);
    const attributes = response.user_attributes || [];

    return json({ user_attributes: attributes }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching personal data fields:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch preferences";
    return json({ error: message }, { status: 500 });
  }
};

// POST: Create a new personal data field
export const POST: RequestHandler = async ({ locals, request }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for creating preference");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, value, type } = body;

    if (!name || value === undefined) {
      return json({ error: "name and value are required" }, { status: 400 });
    }

    const endpoint = `/obp/v6.0.0/my/personal-data-fields`;
    const response = await obp_requests.post(endpoint, {
      name,
      value: String(value),
      type: type || "STRING",
    }, accessToken);

    return json(response, { status: 201 });
  } catch (err) {
    logger.error("Error creating personal data field:", err);
    const message = err instanceof Error ? err.message : "Failed to create preference";
    return json({ error: message }, { status: 500 });
  }
};

// PUT: Update an existing personal data field
export const PUT: RequestHandler = async ({ locals, request }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for updating preference");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { user_attribute_id, name, value, type } = body;

    if (!user_attribute_id || !name || value === undefined) {
      return json({ error: "user_attribute_id, name, and value are required" }, { status: 400 });
    }

    const endpoint = `/obp/v6.0.0/my/personal-data-fields/${encodeURIComponent(user_attribute_id)}`;
    const response = await obp_requests.put(endpoint, {
      name,
      value: String(value),
      type: type || "STRING",
    }, accessToken);

    return json(response, { status: 200 });
  } catch (err) {
    logger.error("Error updating personal data field:", err);
    const message = err instanceof Error ? err.message : "Failed to update preference";
    return json({ error: message }, { status: 500 });
  }
};
