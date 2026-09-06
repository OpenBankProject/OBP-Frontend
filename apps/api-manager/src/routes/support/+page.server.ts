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
const logger = createLogger('SupportPage');
import { obp_requests } from '$lib/obp/requests';

const DEFAULT_SUPPORT_PLATFORM_URL = 'https://chat.openbankproject.com';

interface WebUIProp {
	name: string;
	value: string;
}

export async function load() {
	let supportPlatformUrl = DEFAULT_SUPPORT_PLATFORM_URL;

	try {
		const json = await obp_requests.get('/obp/v6.0.0/webui-props?active=true');
		const prop = (json?.webui_props as WebUIProp[] | undefined)?.find(
			(p) => p.name === 'webui_support_platform_url'
		);
		if (prop?.value) {
			supportPlatformUrl = prop.value;
		}
	} catch (e) {
		// Public page must render even if OBP-API is unreachable; fall back to the default.
		logger.warn('Could not fetch webui_support_platform_url, using default:', e);
	}

	return { supportPlatformUrl };
}
