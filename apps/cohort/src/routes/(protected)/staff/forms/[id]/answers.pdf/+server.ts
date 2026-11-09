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
import { getForm } from '$lib/server/forms';
import { userToken } from '$lib/server/records';
import { formAnswersReport, reportResponse } from '$lib/server/reports';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const token = userToken(locals);
	if (!token) return new Response('Log in first', { status: 401 });
	const form = await getForm(params.id).catch(() => null);
	if (!form) return new Response('Form not found', { status: 404 });
	try {
		return reportResponse(await formAnswersReport(form, token), 'pdf');
	} catch (err) {
		return new Response(`Could not read the answers: ${err instanceof Error ? err.message : String(err)}`, { status: 403 });
	}
};
