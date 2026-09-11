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
import { error } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import {
	explorerGlossaryIndexUrl,
	explorerGlossaryTitleUrl,
	glossaryEntryUrl,
	DEFAULT_EXTERNAL_EXPLORER_URL
} from '@obp/shared/explorer';
import { loadGlossaryEntry } from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * One glossary entry. Links between entries are rewritten to these pages when the anchor
 * resolves here, and to the configured Explorer when it does not, so no link silently 404s.
 */
export const load: PageServerLoad = async ({ params }) => {
	const baseUrl = publicEnv.PUBLIC_OBP_BASE_URL ?? '';
	const externalExplorerUrl = String(env.API_EXPLORER_URL || DEFAULT_EXTERNAL_EXPLORER_URL);

	const entry = await loadGlossaryEntry(params.title, {
		baseUrl,
		targets: {
			entryHref: (title) => explorerGlossaryTitleUrl(title),
			indexHref: explorerGlossaryIndexUrl(),
			fallbackHref: (anchor) => glossaryEntryUrl(anchor, externalExplorerUrl)
		}
	});

	if (!entry) {
		error(404, `The glossary has no entry "${params.title}"`);
	}

	return { entry };
};
