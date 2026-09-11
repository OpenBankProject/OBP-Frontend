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
import { obp_requests } from '$lib/obp/requests';
import { createLogger } from '@obp/shared/utils';
import {
	connectorLabel,
	isKnownConnector,
	loadMessageDocIndex,
	MESSAGE_DOC_CONNECTORS
} from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

const logger = createLogger('ExplorerMessageDocs');

/**
 * Every message one connector documents — the calls OBP makes outwards to a core banking
 * adapter, which is the other half of the API.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	if (!isKnownConnector(params.connector)) {
		error(404, `"${params.connector}" is not a connector this OBP build serves message docs for.`);
	}

	const force = url.searchParams.get('refresh') === '1';

	try {
		const { rows, duplicateProcesses } = await loadMessageDocIndex(obp_requests, params.connector, {
			force
		});
		return {
			connector: params.connector,
			connectorLabel: connectorLabel(params.connector),
			connectors: MESSAGE_DOC_CONNECTORS.map((c) => ({ ...c })),
			rows,
			duplicateProcesses,
			loadError: null as string | null,
			obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? ''
		};
	} catch (e) {
		logger.error(`Could not load message docs for ${params.connector}:`, e);
		return {
			connector: params.connector,
			connectorLabel: connectorLabel(params.connector),
			connectors: MESSAGE_DOC_CONNECTORS.map((c) => ({ ...c })),
			rows: [],
			duplicateProcesses: [] as string[],
			loadError: e instanceof Error ? e.message : String(e),
			obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? ''
		};
	}
};
