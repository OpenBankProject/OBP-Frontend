import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ProviderLogin');
import { generateState } from 'arctic'
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory'
import type { RequestEvent } from '@sveltejs/kit'
import { error } from "@sveltejs/kit";

export function GET(event: RequestEvent) {
    const { provider } = event.params;

    if (!provider) {
        logger.error('No provider specified in URL');
        throw error(400, 'Provider not specified');
    }

    // Check if the requested provider is available
    const oauthClient = oauth2ProviderFactory.getClient(provider);
    if (!oauthClient) {
        logger.error(
            `OAuth client for provider "${provider}" not found. Available providers: ${Array.from(oauth2ProviderFactory.getAllClients().keys()).join(', ')}`
        );
        throw error(404, 'OAuth provider not found');
    }

    const state = generateState();
    // Encode provider in the state - format "state:provider"
    const encodedState = `${state}:${provider}`;

    const scopes = ['openid', 'email', 'profile'];

    logger.debug(`OAuth client found for provider: ${provider}`);
    logger.debug(`OIDC Config present: ${!!oauthClient.OIDCConfig}`);
    if (oauthClient.OIDCConfig) {
        logger.debug(`Authorization endpoint: ${oauthClient.OIDCConfig.authorization_endpoint}`);
        logger.debug(`Token endpoint: ${oauthClient.OIDCConfig.token_endpoint}`);
    } else {
        logger.info('OIDC Config not present on OAuth client. Retry to get config form OIDC well-known endpoint.');
    }

    const auth_endpoint = oauthClient.OIDCConfig?.authorization_endpoint;
    if (!auth_endpoint) {
        logger.error('Authorization endpoint not found in OIDC configuration.');
        logger.error(`Full OIDC config: ${JSON.stringify(oauthClient.OIDCConfig, null, 2)}`);
        throw error(500, 'OAuth configuration error');
    }

    // Preserve OBP consent flow params across the OAuth login round-trip
    const consentRequestId = event.url.searchParams.get('consent_request_id');
    const bankId = event.url.searchParams.get('bank_id');
    const requestedOidcReturnUrl = event.url.searchParams.get('oidc_return_url');

    // oidc_return_url must point back to a configured OIDC provider host — otherwise
    // it becomes an open redirect that also leaks consent_id/user_id on completion.
    let oidcReturnUrl: string | null = null;
    if (requestedOidcReturnUrl) {
        if (oauth2ProviderFactory.isTrustedOidcReturnUrl(requestedOidcReturnUrl)) {
            oidcReturnUrl = requestedOidcReturnUrl;
        } else {
            logger.warn(`Rejected untrusted oidc_return_url: ${requestedOidcReturnUrl}`);
        }
    }

    logger.info(`Login request for provider: ${provider}, URL params: consent_request_id=${consentRequestId}, bank_id=${bankId}, oidc_return_url=${oidcReturnUrl}`);

    if (consentRequestId) {
        const consentFlowData = JSON.stringify({
            consent_request_id: consentRequestId,
            bank_id: bankId || '',
            oidc_return_url: oidcReturnUrl || '',
        });
        event.cookies.set('obp_consent_flow', consentFlowData, {
            httpOnly: true,
            maxAge: 60 * 10,
            secure: import.meta.env.PROD,
            path: '/',
            sameSite: 'lax'
        });
        logger.info(`Set obp_consent_flow cookie: ${consentFlowData}`);
    } else {
        logger.info('No consent_request_id in login request - normal login flow');
    }

    try {
        const url = oauthClient.createAuthorizationURL(auth_endpoint, encodedState, scopes);
        logger.info(`Authorization redirect for provider "${provider}" - client_id: ${url.searchParams.get('client_id') || 'N/A'}, auth_endpoint: ${auth_endpoint}`);
        logger.debug(`Full authorization URL: ${url.toString()}`);

        event.cookies.set('obp_oauth_state', encodedState, {
            httpOnly: true,
            maxAge: 60 * 10,
            secure: import.meta.env.PROD,
            path: '/',
            sameSite: 'lax'
        });

        return new Response(null, {
            status: 302,
            headers: {
                Location: url.toString()
            }
        });
    } catch (err) {
        logger.error(`Error during ${provider} OAuth login:`, err);
        throw error(500, 'Internal Server Error');
    }
}
