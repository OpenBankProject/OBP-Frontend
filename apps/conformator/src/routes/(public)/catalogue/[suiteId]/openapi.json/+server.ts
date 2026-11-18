/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { error, json } from '@sveltejs/kit';
import { getRecord } from '$lib/server/records';
import { SUITE } from '$lib/server/entities/definitions';
import { suiteDocument } from '$lib/server/sources';
import { messageOf } from '$lib/server/errors';
import type { RequestHandler } from './$types';

/**
 * A suite's OpenAPI document, for the runner's schema checks and for anyone reading the catalogue. For a file loaded
 * into OBP as dynamic endpoints, it is read from OBP with the app's own Scope; otherwise from the suite's address.
 */
export const GET: RequestHandler = async ({ params }) => {
	let suite;
	try {
		suite = (await getRecord(SUITE, params.suiteId, undefined, { access: 'public' })).record;
	} catch (err) {
		error(404, `There is no such suite: ${messageOf(err)}`);
	}
	try {
		const document = await suiteDocument(suite);
		if (!document) error(404, 'This suite names no OpenAPI document.');
		return json(document, { headers: { 'cache-control': 'public, max-age=300' } });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		error(503, `The suite's OpenAPI document cannot be read just now: ${messageOf(err)}`);
	}
};
