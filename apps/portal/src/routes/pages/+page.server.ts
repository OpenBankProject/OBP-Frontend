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
import { createLogger } from '@obp/shared/utils';
import { listPublishedPages, PortalPagesUnavailable } from '$lib/server/landing/portalPages';

const logger = createLogger('PagesIndex');

export const load: PageServerLoad = async () => {
	try {
		const pages = await listPublishedPages();
		return {
			pages: pages.map(({ source, ...rest }) => rest),
			unavailable: ''
		};
	} catch (e) {
		const message = e instanceof PortalPagesUnavailable ? e.message : 'Pages are not available right now.';
		logger.error('Pages index unavailable:', e);
		return { pages: [], unavailable: message };
	}
};
