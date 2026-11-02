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
import { toCsv } from '$lib/dashboard';
import { answersOf } from '$lib/forms';
import { answersRecords, getForm } from '$lib/server/forms';
import { userToken } from '$lib/server/records';
import type { RequestHandler } from './$types';

/** Every submitted answer to a form as CSV, one column per question, read with its dynamic entity's Get Role. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const token = userToken(locals);
	if (!token) return new Response('Log in first', { status: 401 });
	const form = await getForm(params.id).catch(() => null);
	if (!form) return new Response('Form not found', { status: 404 });
	let records;
	try {
		records = (await answersRecords(form, 'community', token)).filter((r) => r.submitted_at);
	} catch (err) {
		return new Response(`Could not read the answers: ${err instanceof Error ? err.message : String(err)}`, { status: 403 });
	}
	const csv = toCsv(
		[form.purpose === 'survey' ? 'participant_id' : 'application_id', 'startup', 'submitted_at', ...form.questions.map((q) => q.key)],
		records.map((r) => {
			const answers = answersOf(form.questions, r.record);
			return [r.subject_id, r.startup_name, r.submitted_at, ...form.questions.map((q) => answers[q.key] ?? '')];
		})
	);
	return new Response(csv, {
		headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${form.entity_name || 'cohort-form'}-answers.csv"` }
	});
};
