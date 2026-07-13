// App wiring only — strategy, factory and manager logic lives in @obp/shared/server/oauth.
import { OAuth2ProviderManager } from '@obp/shared/server/oauth';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';

export type { ProviderStatus } from '@obp/shared/server/oauth';

export const oauth2ProviderManager = new OAuth2ProviderManager(oauth2ProviderFactory, obp_requests, {
	wellKnownEndpoint: '/obp/v5.1.0/well-known'
});
