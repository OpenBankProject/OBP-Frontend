import { oauth2ProviderManager, type ProviderStatus } from '$lib/oauth/providerManager';
import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url }) => {
	const errorMessage = url.searchParams.get('error');
	const redirectTo = url.searchParams.get('redirect_to') || '';
	const allProviders = oauth2ProviderManager.getAllProviders();
	const availableProviders = oauth2ProviderManager.getAvailableProviders();
	const unavailableProviders = oauth2ProviderManager.getUnavailableProviders();

	// If we have exactly 1 available provider, redirect directly to it
	if (availableProviders.length === 1) {
		const providerUrl = `/login/${availableProviders[0].provider}${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`;
		throw redirect(302, providerUrl);
	}

	// Return all providers for user selection (0, 2+ available providers)
	return {
		allProviders,
		availableProviders,
		unavailableProviders,
		loading: false,
		lastUpdated: new Date().toISOString(),
		errorMessage,
		redirectTo
	};
};
