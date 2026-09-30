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
import type { PageServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import { resolveWebUiValues } from '@obp/shared/server/obp';
import { obp_requests } from '$lib/obp/requests';

// Operator-configurable text: webui_prop (e.g. webui_welcome_title_manager), then env var, then default
const WEB_UI_TEXT = {
	welcomeTitle: { envVar: 'PUBLIC_WELCOME_TITLE_MANAGER', default: 'Welcome!' },
	helpQuestion: { envVar: 'PUBLIC_HELP_QUESTION_MANAGER', default: 'How can I help?' },
	welcomeDescription: {
		envVar: 'PUBLIC_WELCOME_DESCRIPTION_MANAGER',
		default: 'Welcome to the Open Bank Project API Manager — manage your OBP API instance, configure settings, and explore the full power of the Open Bank Project.'
	}
};

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;

	return {
		user: session?.data?.user || null,
		webUiText: await resolveWebUiValues((path) => obp_requests.get(path), publicEnv, WEB_UI_TEXT)
	};
};
