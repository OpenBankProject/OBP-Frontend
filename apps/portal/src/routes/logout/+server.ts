import { createLogger } from '$lib/utils/logger';
const logger = createLogger('LogoutServer');
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import type { RequestEvent } from "@sveltejs/kit";
// Response is a global type, no need to import it

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

    // Get the access token before destroying session
    const accessToken = session.data.oauth?.access_token;
    const userId = session.data.user.user_id;

    // Clear the session cookie and destroy the session
    event.cookies.delete("obp-portal-connect.sid", {
        path: "/",
    });
    await session.destroy();

    // Try to revoke the access token if it exists and revocation endpoint is available
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
