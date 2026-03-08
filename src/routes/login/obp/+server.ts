import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OBPLogin');
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import type { RequestEvent } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

export function GET(event: RequestEvent) {
	// Use first available provider discovered from OBP well-known endpoint
	const provider = oauth2ProviderFactory.getFirstAvailableProvider();
	if (!provider) {
		logger.error('No OAuth providers available. Check OBP configuration and well-known endpoints.');
		throw error(500, 'OAuth provider not configured');
	}

	// Redirect to the generic provider route for backward compatibility
	const redirectTo = event.url.searchParams.get('redirect_to');
	const providerUrl = `/login/${provider}${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`;
	logger.debug(`Redirecting to generic provider route: ${providerUrl}`);
	throw redirect(302, providerUrl);
}
