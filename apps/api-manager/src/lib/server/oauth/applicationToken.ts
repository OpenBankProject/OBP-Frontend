import { oauth2ProviderFactory } from "$lib/oauth/providerFactory";
import { env } from "$env/dynamic/private";
import { getApplicationAccessToken as getShared } from "@obp/shared/server/oauth";

/**
 * An application access token (client_credentials grant) for the API Manager's own consumer,
 * so startup tasks can call OBP without a logged-in user. Shared implementation, this app's client.
 */
export async function getApplicationAccessToken(): Promise<string | null> {
  return getShared(oauth2ProviderFactory.getPrimaryClient(), env.OBP_OAUTH_CLIENT_ID, env.OBP_OAUTH_CLIENT_SECRET);
}
