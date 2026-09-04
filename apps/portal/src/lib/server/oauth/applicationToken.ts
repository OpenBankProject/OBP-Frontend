import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import { env } from '$env/dynamic/private';
import { getApplicationAccessToken as getShared } from '@obp/shared/server/oauth';

/**
 * An application access token (client_credentials grant) for the Portal's own consumer, so
 * server code can read OBP without a visitor's session, e.g. published pages for anonymous
 * visitors. Shared implementation, this app's client.
 */
export async function getApplicationAccessToken(): Promise<string | null> {
	return getShared(oauth2ProviderFactory.getPrimaryClient(), env.OBP_OAUTH_CLIENT_ID, env.OBP_OAUTH_CLIENT_SECRET);
}
