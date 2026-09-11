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
import { error, redirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import {
	endpointPath,
	explorerCatalogueUrl,
	explorerEndpointUrl,
	findDocByOperationId
} from '@obp/shared/explorer';
import {
	fetchApiVersions,
	fetchResourceDocs,
	findByFullyQualified
} from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * API Explorer II's URL shape, kept alive:
 *
 *   /resource-docs/OBPv7.0.0?operationid=OBPv6.0.0-getBanks
 *
 * The API Manager already emits these from its glossary, message-docs and other pages,
 * and they are pasted into tickets and chat. Serving them as redirects to the canonical
 * endpoint URL is what lets API_EXPLORER_URL be the entire cutover: point it at the
 * Portal and every existing link resolves here; point it back and nothing changed.
 *
 * The redirect is temporary (307) on purpose — a permanent one would be cached by
 * browsers long after any decision to move back.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const versions = await fetchApiVersions(obp_requests);
	const version = findByFullyQualified(versions, params.version);
	if (!version) {
		error(404, `No API version ${params.version}`);
	}

	const operationId = url.searchParams.get('operationid');
	if (!operationId) {
		redirect(307, explorerCatalogueUrl(version.urlPrefix, version.shortVersion));
	}

	const docs = await fetchResourceDocs(obp_requests, version.fullyQualifiedVersion);
	const doc = findDocByOperationId(docs, operationId);
	if (!doc) {
		// The operation is not in this catalogue; the catalogue itself is still useful.
		redirect(307, explorerCatalogueUrl(version.urlPrefix, version.shortVersion, { q: operationId }));
	}

	redirect(307, explorerEndpointUrl(doc.request_verb, endpointPath(doc)));
};
