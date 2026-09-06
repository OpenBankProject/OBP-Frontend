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
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createLogger } from '@obp/shared/utils';
import { expandLiveTags } from '@obp/shared/landing';
import { buildLandingFetchers } from '@obp/shared/server/landing';
import { obp_requests } from '$lib/obp/requests';
import { getPublishedPage, PortalPagesUnavailable } from '$lib/server/landing/portalPages';
import { sanitizePageHtml } from '$lib/server/landing/sanitize';
import { getApplicationAccessToken } from '$lib/server/oauth/applicationToken';

const logger = createLogger('PageBySlug');

export const load: PageServerLoad = async ({ params, locals }) => {
	let page;
	try {
		page = await getPublishedPage(params.slug);
	} catch (e) {
		logger.error(`Page ${params.slug} unavailable:`, e);
		error(503, { message: e instanceof PortalPagesUnavailable ? e.message : 'Pages are not available right now.' });
	}
	if (!page) error(404, { message: `No published page called "${params.slug}".` });

	const base = { slug: page.slug, title: page.title, kind: page.kind, summary: page.summary, updated_at: page.updated_at };

	if (page.kind === 'app') {
		// The App's source goes to the browser as-is: it only ever runs inside the sandboxed iframe.
		return { ...base, source: page.source, html: '', isLoggedIn: !!locals.session?.data?.user };
	}

	// A Page is rendered inline: sanitise the author's source, then fill the live-data tags
	// with the catalogue using the Portal's own application token (visitors may be anonymous).
	const token = (await getApplicationAccessToken()) ?? undefined;
	const fetchers = buildLandingFetchers((path, t) => obp_requests.get(path, t), token, {
		portalUrl: '',
		explorerUrl: String(env.API_EXPLORER_URL ?? '').replace(/\/$/, '').replace(/\/\?.*$/, '')
	});
	const html = await expandLiveTags(sanitizePageHtml(page.source), fetchers, { onError: 'hide' });
	return { ...base, source: '', html, isLoggedIn: !!locals.session?.data?.user };
};
