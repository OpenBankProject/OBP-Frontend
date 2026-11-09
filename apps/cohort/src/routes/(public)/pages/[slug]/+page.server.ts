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
import { pageView } from '$lib/server/pageView';
import { cohortPage } from '$lib/server/sitePages';
import type { PageServerLoad } from './$types';

/** A page published to Cohort with App Studio (see lib/server/pageView). */
export const load: PageServerLoad = async ({ params, locals }) => {
	const page = await cohortPage(params.slug, locals.locale);
	if (!page) error(404, { message: `No published page called "${params.slug}".` });
	return pageView(page, !!locals.session?.data?.user);
};
