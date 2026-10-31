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
import { createLogger } from '@obp/shared/utils';
import { obpRequests } from './obp';

const logger = createLogger('CohortAppDirectory');

/** The app directory entry naming the API Manager's URL. */
export const API_MANAGER_DIRECTORY_NAME = 'public_obp_api_manager_url';

const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; entries: Record<string, string> } | null = null;

/** The entries of OBP-API's app directory (public), by name. Cached; empty when it cannot be read. */
export async function appDirectory(): Promise<Record<string, string>> {
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.entries;
	try {
		const response = await obpRequests.get('/obp/v6.0.0/app-directory');
		const entries: Record<string, string> = {};
		for (const entry of response?.app_directory ?? []) {
			if (entry?.name && entry?.value) entries[entry.name] = String(entry.value);
		}
		cached = { at: Date.now(), entries };
		return entries;
	} catch (err) {
		logger.warn('Could not read the app directory:', err);
		return cached?.entries ?? {};
	}
}

/** The API Manager's base URL, from OBP-API's app directory, or none when the directory has no entry for it. */
export function apiManagerUrlFrom(directory: Record<string, string>): string | null {
	const url = directory[API_MANAGER_DIRECTORY_NAME] || '';
	return url ? url.replace(/\/+$/, '') : null;
}

export async function apiManagerUrl(): Promise<string | null> {
	return apiManagerUrlFrom(await appDirectory());
}

/** The API Manager's Create Bank page, with its form filled in for Cohort's space. */
export function createBankUrl(apiManager: string, bankId: string): string {
	const query = new URLSearchParams({ bank_id: bankId, full_name: 'OBP-Cohort', bank_code: bankId.toUpperCase() });
	return `${apiManager}/banks/create?${query}`;
}

/** The API Manager's Platform Apps page, with its form filled in for this Consumer. */
export function platformAppsUrl(apiManager: string, consumerId: string, label = 'OBP-Cohort'): string {
	const query = new URLSearchParams({ consumer_id: consumerId, label });
	return `${apiManager}/consumers/platform-apps?${query}`;
}
