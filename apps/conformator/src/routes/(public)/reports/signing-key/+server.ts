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
import { reportSigner } from '$lib/server/reports';
import type { RequestHandler } from './$types';

/** The public key reports are signed with (Ed25519, PEM), and its id. */
export const GET: RequestHandler = async () => {
	const { signer } = reportSigner();
	if (!signer) error(404, 'No report signing key is set up.');
	return new Response(signer.publicKeyPem, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-key-id': signer.keyId } });
};
