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
import { answersOf, entityNameFor, growthProblem, keyFor, parseOptions, QUESTION_KINDS, summarise, type Form, type Question, type QuestionKind } from '$lib/forms';
import type { Locale } from '$lib/i18n';
import { nowUtc } from '$lib/screening';
import { CALL, FORM, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { answersRecords, answersRole, getForm, listForms, publishDefinition, saveForm } from '$lib/server/forms';
import { createRecord, getRecord, idOf, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	create: `CanCreateDynamicEntityRecord_${FORM}`,
	edit: `CanUpdateDynamicEntityRecord_${FORM}`,
	publish: 'CanCreateDynamicEntityDefinition',
	grow: 'CanUpdateDynamicEntityDefinition'
};

async function formOr404(id: string) {
	try {
		return await getForm(id);
	} catch {
		error(404, 'Form not found');
	}
}

/**
 * A form in the builder: its questions, and once published the answers, read through the community URL of its
 * dynamic entity with that dynamic entity's Get Role (the staff member who published it holds it from then on).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const form = await formOr404(params.id);
	const published = form.status !== 'draft' && !!form.entity_name;
	const extra = published ? [{ role_name: answersRole(form.entity_name), purpose: 'access_purpose_read_form_answers' }] : [];
	const [target, access, versions] = await Promise.allSettled([
		form.purpose === 'survey' ? getRecord(PROGRAMME, 'public', form.programme_id) : getRecord(CALL, 'public', form.call_id),
		staffAccess(token, extra),
		listForms()
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lackingOf = (name: string) => roles.find((r) => r.role_name === name && !r.held) ?? null;
	const lacking = {
		create: lackingOf(ROLES.create),
		edit: lackingOf(ROLES.edit),
		publish: lackingOf(ROLES.publish),
		grow: lackingOf(ROLES.grow),
		answers: published ? lackingOf(answersRole(form.entity_name)) : null
	};
	let responses: { subject_id: string; startup_name: string; submitted_at: string; answers: Record<string, unknown> }[] = [];
	let answersError: string | null = null;
	if (published && !lacking.answers) {
		try {
			responses = (await answersRecords(form, 'community', token)).map((r) => ({ subject_id: r.subject_id, startup_name: r.startup_name, submitted_at: r.submitted_at, answers: answersOf(form.questions, r.record) }));
		} catch (err) {
			answersError = messageOf(err);
		}
	}
	const submitted = responses.filter((r) => r.submitted_at);
	// The other versions: every application form of the call, or the survey this one replaces and its replacement.
	const sameTarget = (versions.status === 'fulfilled' ? versions.value : []).filter(
		(f) => f.id !== form.id && (form.purpose === 'application' ? f.purpose === 'application' && f.call_id === form.call_id : f.id === form.replaces_form_id || f.replaces_form_id === form.id)
	);
	return {
		form,
		target: target.status === 'fulfilled'
			? { id: form.purpose === 'survey' ? form.programme_id : form.call_id, name: String(target.value.title ?? target.value.name ?? '') }
			: null,
		otherVersions: sameTarget.map((f) => ({ id: f.id, version: f.version, status: f.status })).sort((a, b) => a.version - b.version),
		lacking,
		responses: submitted.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
		drafts: responses.length - submitted.length,
		summary: summarise(form.questions, submitted.map((r) => r.answers as never), locals.locale as Locale),
		answersError,
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** A question's text and choices from the builder's form; the key and the published flag are kept from before. */
function readQuestion(form: FormData, before?: Question): Question | null {
	const label = str(form, 'label').slice(0, 500);
	const labelAr = str(form, 'label_ar').slice(0, 500);
	const kind = (before?.published ? before.kind : str(form, 'kind')) as QuestionKind;
	if ((!label && !labelAr) || !(QUESTION_KINDS as readonly string[]).includes(kind)) return null;
	const options = kind === 'select' ? parseOptions(str(form, 'options')) : undefined;
	if (kind === 'select' && !options?.length) return null;
	return {
		key: before?.key ?? '',
		kind,
		label,
		label_ar: labelAr,
		...(str(form, 'help') ? { help: str(form, 'help').slice(0, 1000) } : {}),
		...(str(form, 'help_ar') ? { help_ar: str(form, 'help_ar').slice(0, 1000) } : {}),
		...(options ? { options } : {}),
		...(form.get('required') ? { required: true } : {}),
		...(before?.published ? { published: true } : {}),
		...(before?.hidden ? { hidden: true } : {})
	};
}

/**
 * Save the edited questions. A published form's dynamic entity is updated first when a question is new to it, so the
 * form never lists a question its dynamic entity cannot store.
 */
async function change(id: string, locals: App.Locals, edit: (form: Form) => Form | string) {
	const token = userToken(locals)!;
	const before = await formOr404(id);
	if (before.status === 'closed') return fail(400, { error: 'closed' });
	const after = edit(before);
	if (typeof after === 'string') return fail(400, { error: after });
	const problem = growthProblem(before.questions, after.questions);
	if (problem) return fail(400, { error: problem });
	try {
		if (after.status !== 'draft' && after.questions.some((q) => !q.published)) {
			const grown = { ...after, questions: after.questions.map((q) => ({ ...q, published: true })) };
			await publishDefinition(grown, token);
			await saveForm(grown, token);
		} else {
			await saveForm(after, token);
		}
	} catch (err) {
		return fail(400, { error: messageOf(err) });
	}
	return { saved: true };
}

export const actions: Actions = {
	addQuestion: async ({ params, locals, request }) => {
		const data = await request.formData();
		return change(params.id, locals, (form) => {
			const q = readQuestion(data);
			if (!q) return 'invalid_question';
			q.key = keyFor(q.label, form.questions.map((x) => x.key));
			return { ...form, questions: [...form.questions, q] };
		});
	},
	updateQuestion: async ({ params, locals, request }) => {
		const data = await request.formData();
		return change(params.id, locals, (form) => {
			const before = form.questions.find((q) => q.key === str(data, 'key'));
			if (!before) return 'invalid_question';
			const q = readQuestion(data, before);
			if (!q) return 'invalid_question';
			return { ...form, questions: form.questions.map((x) => (x.key === q.key ? q : x)) };
		});
	},
	moveQuestion: async ({ params, locals, request }) => {
		const data = await request.formData();
		return change(params.id, locals, (form) => {
			const i = form.questions.findIndex((q) => q.key === str(data, 'key'));
			const j = i + (str(data, 'direction') === 'up' ? -1 : 1);
			if (i < 0 || j < 0 || j >= form.questions.length) return form;
			const questions = [...form.questions];
			[questions[i], questions[j]] = [questions[j], questions[i]];
			return { ...form, questions };
		});
	},
	/** A draft's question is removed; a published one can only be hidden (and shown again), as its answers stay. */
	removeQuestion: async ({ params, locals, request }) => {
		const data = await request.formData();
		return change(params.id, locals, (form) => {
			const q = form.questions.find((x) => x.key === str(data, 'key'));
			if (!q) return 'invalid_question';
			if (!q.published) return { ...form, questions: form.questions.filter((x) => x.key !== q.key) };
			return { ...form, questions: form.questions.map((x) => (x.key === q.key ? { ...x, hidden: !x.hidden } : x)) };
		});
	},
	/**
	 * Publish: the form becomes its own dynamic entity, created with the staff member's Role, and is offered to
	 * applicants or startups. The version it replaces is closed.
	 */
	publish: async ({ params, locals }) => {
		const token = userToken(locals)!;
		const form = await formOr404(params.id);
		if (form.status !== 'draft') return fail(400, { error: 'not_draft' });
		if (form.questions.length === 0) return fail(400, { error: 'no_questions' });
		const ready: Form = { ...form, entity_name: form.entity_name || entityNameFor(form.id), questions: form.questions.map((q) => ({ ...q, published: true })) };
		try {
			const { dynamic_entity_id } = await publishDefinition(ready, token);
			await saveForm({ ...ready, dynamic_entity_id, status: 'published', published_at: nowUtc() }, token, locals.session.data.user?.username ?? '');
			// A call has one application form at a time; a survey closes only the version it replaces.
			const older = (await listForms()).filter(
				(f) => f.id !== form.id && f.status === 'published' && (form.purpose === 'application' ? f.purpose === 'application' && f.call_id === form.call_id : f.id === form.replaces_form_id)
			);
			for (const f of older) await saveForm({ ...f, status: 'closed' }, token);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { published: true };
	},
	close: async ({ params, locals }) => {
		const form = await formOr404(params.id);
		if (form.status !== 'published') return fail(400, { error: 'not_published' });
		try {
			await saveForm({ ...form, status: 'closed' }, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { closed: true };
	},
	reopen: async ({ params, locals }) => {
		const form = await formOr404(params.id);
		if (form.status !== 'closed') return fail(400, { error: 'not_closed' });
		try {
			await saveForm({ ...form, status: 'published' }, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { reopened: true };
	},
	/** A new version: a draft copy of the questions still asked, to change freely and publish as a new dynamic entity. */
	newVersion: async ({ params, locals }) => {
		const form = await formOr404(params.id);
		const versions = (await listForms().catch(() => [])).filter((f) => f.purpose === 'application' && form.purpose === 'application' && f.call_id === form.call_id);
		let id = '';
		try {
			const created = await createRecord(
				FORM,
				'',
				{
					purpose: form.purpose,
					title: form.title,
					...(form.title_ar ? { title_ar: form.title_ar } : {}),
					...(form.description ? { description: form.description } : {}),
					...(form.description_ar ? { description_ar: form.description_ar } : {}),
					[form.purpose === 'survey' ? 'programme_id' : 'call_id']: form.purpose === 'survey' ? form.programme_id : form.call_id,
					status: 'draft',
					version: Math.max(form.version, ...versions.map((f) => f.version)) + 1,
					replaces_form_id: form.id,
					questions: JSON.stringify(form.questions.filter((q) => !q.hidden).map(({ published: _p, hidden: _h, ...q }) => q))
				},
				userToken(locals)!
			);
			id = idOf(FORM, created);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { newVersion: id };
	},
	/** The title and the text above the questions, in both languages. */
	details: async ({ params, locals, request }) => {
		const data = await request.formData();
		return change(params.id, locals, (form) => {
			if (!str(data, 'title')) return 'invalid';
			return { ...form, title: str(data, 'title'), title_ar: str(data, 'title_ar'), description: str(data, 'description'), description_ar: str(data, 'description_ar') };
		});
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
