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
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('signatory-panels/+page.server');

const API_VERSION = 'v6.0.0';

export interface PanelRow {
	panel_id: string;
	panel_name: string;
	description: string;
	user_ids: string[];
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id, mandate_id } = event.params;
	const accessToken = event.locals.session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id || !mandate_id) {
		error(400, { message: 'bank_id, account_id, and mandate_id are required.' });
	}

	const url = `/obp/${API_VERSION}/banks/${encodeURIComponent(bank_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels`;

	let panels: PanelRow[] = [];
	let fetchError: string | null = null;

	try {
		const response = await obp_requests.get(url, accessToken);
		const raw = response.signatory_panels ?? [];
		panels = raw.map((p: any): PanelRow => ({
			panel_id: p.panel_id,
			panel_name: p.panel_name,
			description: p.description ?? '',
			user_ids: p.user_ids ?? []
		}));
	} catch (e) {
		logger.error('Failed to fetch signatory panels:', e);
		fetchError = e instanceof Error ? e.message : String(e);
	}

	return { bank_id, account_id, mandate_id, panels, fetchError };
}
