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
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const rawHost = publicEnv.PUBLIC_OBP_BASE_URL || '';
	// Strip protocol for display in code examples
	const apiHost = rawHost.replace(/^https?:\/\//, '');
	// Strip query params and trailing slash to get a clean base for constructing links
	const rawExplorerUrl = env.API_EXPLORER_URL || '';
	const apiExplorerUrl = rawExplorerUrl.split('?')[0].replace(/\/$/, '');
	// The OBP-MCP server URL is advertised by the OBP backend via the
	// app-directory (public_obp_mcp_url) and surfaced by the root layout load.
	const { publicObpMcpUrl } = await parent();
	return {
		apiHost,
		apiBaseUrl: rawHost,
		apiExplorerUrl,
		mcpUrl: publicObpMcpUrl ?? ''
	};
};
