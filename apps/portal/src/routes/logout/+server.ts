/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { createLogger } from '@obp/shared/utils';
const logger = createLogger('LogoutServer');
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import type { RequestEvent } from "@sveltejs/kit";
import type { SessionOAuthStorageData } from "$lib/oauth/types";
import { env } from "$env/dynamic/private";
// Response is a global type, no need to import it

/**
 * Tell Opey to delete the user's session server-side.
 * The browser sends Opey's 'session' cookie to portal/ on same-origin requests
 * (because the /backend/opey/auth proxy forwarded the Set-Cookie from Opey),
 * so we can just relay the incoming Cookie header to Opey's /delete-session.
 *
 * Time-bounded: never block logout on Opey availability.
 */
async function deleteOpeySession(event: RequestEvent, userId: string) {
    const opeyBaseUrl = env.OPEY_BASE_URL;
    const incomingCookie = event.request.headers.get('cookie');
    if (!opeyBaseUrl || !incomingCookie) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
        const res = await fetch(`${opeyBaseUrl}/delete-session`, {
            method: 'POST',
            headers: { 'Cookie': incomingCookie },
            signal: controller.signal
        });
        if (res.ok) {
            logger.info(`Opey session invalidated for user: ${userId}`);
        } else {
            logger.warn(`Opey /delete-session returned ${res.status} for user: ${userId}`);
        }
    } catch (err) {
        logger.warn(`Opey /delete-session failed for user ${userId} (non-fatal):`, err);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Logout handler that supports both token revocation and Keycloak front-channel logout.
 * 
 * For Keycloak as IdP, this implements Option 2: Front-Channel Logout (Browser-based)
 * Flow:
 * 1. User clicks logout in the app
 * 2. App redirects browser to Keycloak's end_session_endpoint
 * 3. Keycloak ends the session and logs user out of all Keycloak-managed clients
 * 4. Keycloak redirects back to post_logout_redirect_uri
 * 
 * Parameters sent to Keycloak logout endpoint:
 * - id_token_hint: The ID token from the user's session (required for proper logout)
 * - post_logout_redirect_uri: Where to redirect after logout (app origin)
 * 
 * For non-Keycloak providers, falls back to standard token revocation.
 */
export async function GET(event: RequestEvent): Promise<Response> {
    
    const session = event.locals.session;
    if (!session || !session.data.user) {
        logger.warn("No user session found, nothing to revoke.");
        return new Response(null, {
            status: 302,
            headers: {
                Location: `/`
            }
        });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session)
    if (!sessionOAuth) {
        logger.warn("No OAuth session found, nothing to revoke.");
        return new Response(null, {
            status: 302,
            headers: {
                Location: `/`
            }
        });
    }

    // Get tokens and user info before destroying session
    const oauthData = session.data.oauth as SessionOAuthStorageData;
    const accessToken = oauthData?.access_token;
    const idToken = oauthData?.id_token;
    const provider = oauthData?.provider;
    const userId = session.data.user.user_id;

    // Invalidate the Opey session server-side (before destroying our own session,
    // while we still have the incoming Cookie header to forward to Opey).
    await deleteOpeySession(event, userId);

    // Clear the session cookies (portal's own + Opey's 'session' cookie, which
    // is scoped to this origin because the proxy forwarded Opey's Set-Cookie
    // back to the browser as if portal.obp had set it).
    event.cookies.delete("obp-portal-connect.sid", { path: "/" });
    event.cookies.delete("session", { path: "/" });
    await session.destroy();

    // Handle Keycloak front-channel logout
    if (provider === 'keycloak' && idToken) {
        const endSessionEndpoint = sessionOAuth.client.OIDCConfig?.end_session_endpoint;
        if (endSessionEndpoint) {
            logger.info("Performing Keycloak front-channel logout for user:", userId);
            
            const logoutUrl = new URL(endSessionEndpoint);
            logoutUrl.searchParams.append('id_token_hint', idToken);
            logoutUrl.searchParams.append('post_logout_redirect_uri', event.url.origin);

            // Redirect to Keycloak logout endpoint for front-channel logout
            return new Response(null, {
                status: 302,
                headers: {
                    Location: logoutUrl.toString()
                }
            });
        } else {
            logger.warn("Keycloak end_session_endpoint not found, falling back to token revocation");
        }
    }

    // Fallback: Try to revoke the access token if it exists and revocation endpoint is available
    const tokenRevokationUrl = sessionOAuth.client.OIDCConfig?.revocation_endpoint;
    if (accessToken && tokenRevokationUrl) {
        try {
            logger.info("Revoking access token for user:", userId);
            
            const response = await fetch(tokenRevokationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: new URLSearchParams({
                    token: accessToken,
                    token_type_hint: 'access_token'
                })
            });

            if (response.ok) {
                logger.info("Successfully revoked access token for user:", userId);
            } else {
                // Log detailed error information
                const responseText = await response.text();
                logger.error(
                    `Token revocation failed for user: ${userId}`,
                    {
                        status: response.status,
                        statusText: response.statusText,
                        endpoint: tokenRevokationUrl,
                        responseBody: responseText
                    }
                );
            }
        } catch (error) {
            logger.error("Error during token revocation for user:", userId, error);
            // Continue with logout even if revocation fails
        }
    } else {
        if (!accessToken) {
            logger.warn("No access token found in session, skipping revocation.");
        }
        if (!tokenRevokationUrl) {
            logger.warn("No revocation endpoint configured, skipping token revocation.");
        }
    }

    // Redirect to the home page after logout
    return new Response(null, {
        status: 302,
        headers: {
            Location: `/`
        }
    });


}
