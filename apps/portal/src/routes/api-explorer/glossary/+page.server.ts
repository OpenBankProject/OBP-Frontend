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
import { env as publicEnv } from '$env/dynamic/public';
import { loadGlossaryIndex, searchGlossary } from '@obp/shared/server/explorer';
import { createLogger } from '@obp/shared/utils';
import type { PageServerLoad } from './$types';

const logger = createLogger('ExplorerGlossary');

/**
 * The glossary index. Searching covers the bodies as well as the titles, which only the
 * server has, so the query is a URL parameter rather than a client-side filter.
 */
export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = publicEnv.PUBLIC_OBP_BASE_URL ?? '';
	const query = url.searchParams.get('q')?.trim() ?? '';
	const force = url.searchParams.get('refresh') === '1';

	try {
		const { rows, duplicateTitles } = await loadGlossaryIndex({ baseUrl, force });
		const matching = query ? await searchGlossary(query, { baseUrl }) : null;
		return {
			rows: matching ? rows.filter((r) => matching.has(r.title)) : rows,
			total: rows.length,
			duplicateTitles,
			query,
			loadError: null as string | null
		};
	} catch (e) {
		logger.error('Could not load the glossary:', e);
		return {
			rows: [],
			total: 0,
			duplicateTitles: [] as string[],
			query,
			loadError: e instanceof Error ? e.message : String(e)
		};
	}
};
