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
import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OBPLogin');
import { oauth2ProviderFactory } from '../../../hooks.server';
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
	logger.debug(`Redirecting to generic provider route: /login/${provider}`);
	throw redirect(302, `/login/${provider}`);
}
