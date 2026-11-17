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
import { error, fail } from '@sveltejs/kit';
import { answersOf, missingAnswers, readAnswers } from '$lib/forms';
import { messageOf } from '$lib/server/errors';
import { getForm, teamAnswers, writeTeamAnswers } from '$lib/server/forms';
import { participantsOfUser } from '$lib/server/participants';
import { userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/**
 * A survey and the startup answering it: one of the participations the User sees in the survey's programme (read by
 * Cohort and narrowed to the User). The startup's team answers once, together: one record of the survey's dynamic
 * entity, shared with the team's Organisation and read and written with the member's own token.
 */
async function surveyAndParticipant(id: string, url: URL, locals: App.Locals) {
	const form = await getForm(id).catch(() => error(404, 'Survey not found'));
	if (form.purpose !== 'survey' || form.status === 'draft') error(404, 'Survey not found');
	const mine = (await participantsOfUser(locals.session.data.user?.user_id ?? '', userToken(locals)!)).filter((p) => p.programme_id === form.programme_id);
	const participant = mine.find((p) => p.id === url.searchParams.get('participant')) ?? mine[0];
	if (!participant) error(403, 'This survey is for the startups of another programme.');
	return { form, participant };
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const { form, participant } = await surveyAndParticipant(params.id, url, locals);
	const team = await teamAnswers(form, participant.id, userToken(locals)!).catch(() => null);
	return {
		form,
		participant: { id: participant.id, startup_name: participant.startup_name },
		answers: answersOf(form.questions, team?.record),
		submitted_at: team?.submitted_at ?? '',
		open: form.status === 'published'
	};
};

async function answer(params: { id: string }, url: URL, locals: App.Locals, request: Request, submit: boolean) {
	const { form, participant } = await surveyAndParticipant(params.id, url, locals);
	if (form.status !== 'published') return fail(400, { error: 'closed' });
	const answers = readAnswers(form.questions, await request.formData());
	const missing = submit ? missingAnswers(form.questions, answers).map((q) => q.key) : [];
	try {
		await writeTeamAnswers(form, participant, answers, submit && missing.length === 0, userToken(locals)!);
	} catch (err) {
		return fail(400, { error: messageOf(err) });
	}
	if (missing.length) return fail(400, { missing });
	return submit ? { submittedNow: true } : { saved: true };
}

export const actions: Actions = {
	save: async ({ params, url, locals, request }) => answer(params, url, locals, request, false),
	submit: async ({ params, url, locals, request }) => answer(params, url, locals, request, true)
};
