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
import { eligibilityInWords, eligibilityRulesOf, isCallOpen } from '$lib/applications';
import { allAnnouncements } from '$lib/server/announcements';
import { CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { idOf, listRecords } from '$lib/server/records';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';
import { cohortSpace } from '$lib/server/space';
import { pageView } from '$lib/server/pageView';
import { cohortPage, HOME_PAGE_SLUG } from '$lib/server/sitePages';

/**
 * The start page: the page published to Cohort with App Studio under the slug "home", in the visitor's language, when
 * there is one; otherwise the open calls. The calls are read publicly so visitors see them without logging in, and
 * are always loaded: Opey answers about them.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const homePage = await cohortPage(HOME_PAGE_SLUG, locals.locale);
	const home = homePage ? await pageView(homePage, !!locals.session?.data?.user) : null;
	// The latest announcements for everyone; those about one programme show on its startups' page.
	const announcements = (await allAnnouncements()).filter((a) => !a.programme_id).slice(0, 5);
	// The Opey panel shows only where Opey is configured. Its public URL is informational (the connection popover).
	// Cohort's bank_id is Opey's default bank; where its data is goes with each message from the server (lib/server/opey).
	const opey = env.OPEY_BASE_URL ? { baseUrl: publicEnv.PUBLIC_OPEY_BASE_URL ?? '', bankId: cohortSpace() } : null;
	try {
		const [calls, programmes] = await Promise.all([listRecords(CALL, 'public'), listRecords(PROGRAMME, 'public')]);
		const programmeNames = new Map(programmes.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
		return {
			calls: calls.filter((c) => isCallOpen(c)).map((c) => ({
				id: idOf(CALL, c),
				title: String(c.title ?? ''),
				description: String(c.description ?? ''),
				opens_at: String(c.opens_at ?? ''),
				closes_at: String(c.closes_at ?? ''),
				programme: programmeNames.get(String(c.programme_id)) ?? '',
				eligibility: eligibilityInWords(eligibilityRulesOf(c))
			})),
			error: null,
			opey,
			announcements,
			home
		};
	} catch (err) {
		return { calls: [], error: messageOf(err), opey, announcements, home };
	}
};
