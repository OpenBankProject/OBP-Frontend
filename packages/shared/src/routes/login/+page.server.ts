import { oauth2ProviderManager } from '../../hooks.server';
import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url }) => {
	const errorMessage = url.searchParams.get('error');
	const successMessage = url.searchParams.get('reset');
	const invitationAccepted = url.searchParams.get('invitation_accepted');
	const allProviders = oauth2ProviderManager.getAllProviders();
	const availableProviders = oauth2ProviderManager.getAvailableProviders();
	const unavailableProviders = oauth2ProviderManager.getUnavailableProviders();

	// If we have exactly 1 available provider and no messages to display, redirect directly to it
	if (availableProviders.length === 1 && !errorMessage && !successMessage && !invitationAccepted) {
		throw redirect(302, `/login/${availableProviders[0].provider}`);
	}

	// Return all providers for user selection (0, 2+ available providers)
	return {
		allProviders,
		availableProviders,
		unavailableProviders,
		loading: false,
		lastUpdated: new Date().toISOString(),
		errorMessage,
		successMessage,
		invitationAccepted
	};
};
