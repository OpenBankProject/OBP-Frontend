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
import { obp_requests } from '$lib/obp/requests';
import { getWebUiProps } from '@obp/shared/server/obp';

const DEFAULT_SUPPORT_PLATFORM_URL = 'https://chat.openbankproject.com';

export async function load() {
	// Falls back to the default if the prop is unset or OBP-API is unreachable
	const props = await getWebUiProps((path) => obp_requests.get(path));
	return { supportPlatformUrl: props.get('webui_support_platform_url') || DEFAULT_SUPPORT_PLATFORM_URL };
}
