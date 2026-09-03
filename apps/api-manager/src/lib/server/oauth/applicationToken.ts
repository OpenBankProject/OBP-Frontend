import { oauth2ProviderFactory } from "$lib/oauth/providerFactory";
import { env } from "$env/dynamic/private";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("ApplicationToken");

/**
 * An application access token (client_credentials grant) for the API Manager's
 * own consumer, so startup tasks can call OBP without a logged-in user.
 * Returns null when the OAuth client is not configured or the grant is refused.
 */
export async function getApplicationAccessToken(): Promise<string | null> {
  const client = oauth2ProviderFactory.getPrimaryClient();
  if (!client?.OIDCConfig?.token_endpoint) {
    logger.warn("No OAuth client or token endpoint available for application access.");
    return null;
  }
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", env.OBP_OAUTH_CLIENT_ID);
  body.set("client_secret", env.OBP_OAUTH_CLIENT_SECRET);
  try {
    const response = await fetch(client.OIDCConfig.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.warn(`Application access token request failed: ${response.status} ${response.statusText}`, errorData);
      return null;
    }
    const tokens = await response.json();
    return tokens.access_token ?? null;
  } catch (err) {
    logger.warn(`Failed to obtain application access token: ${err}`);
    return null;
  }
}
