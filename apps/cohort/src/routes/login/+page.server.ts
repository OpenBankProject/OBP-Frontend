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
import { redirect } from '@sveltejs/kit';
import { RETURN_TO_PARAM, rememberReturnTo } from '@obp/shared/server/auth';
import { oauth2ProviderManager } from '$lib/server/oauth';
import { parseLoginError } from '$lib/server/loginErrors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	if (locals.session.data.user) redirect(302, '/dashboard');

	rememberReturnTo(cookies, url.searchParams.get(RETURN_TO_PARAM));
	const loginError = parseLoginError(url.searchParams.get('error'));
	const available = oauth2ProviderManager.getAvailableProviders().map((p) => p.provider);

	// With one provider and nothing to report, go straight to it.
	if (available.length === 1 && !loginError) redirect(302, `/login/${available[0]}`);

	return { providers: available, loginError };
};
