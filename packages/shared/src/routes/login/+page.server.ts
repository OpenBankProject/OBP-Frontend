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
