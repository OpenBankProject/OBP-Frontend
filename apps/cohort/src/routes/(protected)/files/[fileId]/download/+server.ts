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
import { fetchFileContent } from '$lib/server/files';
import { userToken } from '$lib/server/records';
import type { RequestHandler } from './$types';

/**
 * A file's content, always as a download. It is never shown in the page: Content-Disposition is attachment,
 * the type is not sniffed, and a sandbox CSP stops it running if a browser opens it anyway. OBP decides whether
 * the caller may have it (owner, given access, CanGetFileAtOneBank) and refuses content that is not clean.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const response = await fetchFileContent(params.fileId, userToken(locals)!);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		error(response.status === 404 ? 404 : 403, body?.message ?? 'This file cannot be downloaded.');
	}
	const disposition = response.headers.get('content-disposition') ?? '';
	const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'file';
	return new Response(response.body, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${name.replace(/[^\w.\- ]/g, '_')}"`,
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "sandbox; default-src 'none'",
			'Cache-Control': 'private, no-store'
		}
	});
};
