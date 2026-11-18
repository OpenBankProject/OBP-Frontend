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
import { findReport } from '$lib/server/reports';
import type { RequestHandler } from './$types';

/**
 * The signed report as JSON: its content exactly as signed (canonical JSON text), the hash, the signature and the key
 * id, so anyone can check it with the public key and no help from this site.
 */
export const GET: RequestHandler = async ({ params }) => {
	const found = await findReport(params.reference);
	if (!found) error(404, `There is no report ${params.reference}.`);
	const body = {
		reference: found.report.reference,
		content: found.report.content,
		report_hash: found.report.report_hash,
		signature: found.report.signature,
		signing_key_id: found.report.signing_key_id,
		algorithm: 'Ed25519 over the UTF-8 text of report_hash; report_hash is sha256 of the UTF-8 text of content',
		standing_when_downloaded: found.standing
	};
	return new Response(JSON.stringify(body, null, 2), {
		headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${found.report.reference}.json"` }
	});
};
