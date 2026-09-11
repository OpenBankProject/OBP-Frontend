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
import { obp_requests } from '$lib/obp/requests';
import { explorerCatalogueUrl } from '@obp/shared/explorer';
import { fetchApiVersions, latestVersionFor } from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * The Explorer's front door. There is nothing to show at the root that a catalogue does
 * not show better, so land on the newest OBP version.
 */
export const load: PageServerLoad = async () => {
	const versions = await fetchApiVersions(obp_requests);
	const latest = latestVersionFor(versions, 'obp');
	redirect(307, explorerCatalogueUrl(latest?.urlPrefix ?? 'obp', latest?.shortVersion ?? 'v7.0.0'));
};
