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
import { error } from '@sveltejs/kit';
import { fileContent } from '$lib/server/files';
import { userToken } from '$lib/server/records';
import { spaceParam } from '$lib/server/spaces';
import type { RequestHandler } from './$types';

/** Download an evidence file with the User's own token: OBP-API decides whether they may read it. Never shown inline. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const space = spaceParam(params.spaceId);
	if (!/^[A-Za-z0-9-]{1,64}$/.test(params.fileId)) error(404, 'There is no such file.');
	const response = await fileContent(space, params.fileId, userToken(locals)!);
	if (!response.ok) error(response.status === 403 ? 403 : 404, 'The file cannot be downloaded.');
	return new Response(response.body, {
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
			'content-disposition': 'attachment',
			'cache-control': 'no-store'
		}
	});
};
