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
import { dynamicEntityDefinitionsPath } from '@obp/shared/obp';
import type { SystemDynamicEntityDefinition } from '@obp/shared/server/obp';
import { answersOf, formOf, type Answers, type Form, type Question } from '$lib/forms';
import { nowUtc } from '$lib/screening';
import { FORM } from './entities/definitions';
import { messageOf } from './errors';
import { obpRequests } from './obp';
import { createRecord, getRecord, idOf, listRecords, updateRecord, type Access, type CohortRecord } from './records';
import { cohortFormsSpace, cohortSpace } from './space';

/**
 * Forms from the form builder, and their answers. The form records live in Cohort's space; each published form's
 * dynamic entity, holding its answers, lives in the forms space (`cohortFormsSpace`), so the definition Roles staff
 * need there reach nothing of Cohort's own. Staff build and publish forms with their own Roles: publishing creates the
 * form's dynamic entity with the staff member's CanCreateDynamicEntityDefinition at the forms space (and OBP-API grants
 * them its Record Roles there), and adding questions later updates it with CanUpdateDynamicEntityDefinition. Each
 * applicant or startup writes their own answers as a personal record of that dynamic entity; staff read them all
 * through its community URL with its Get Role at the forms space.
 */

/** The Role that reads every answer to a form. */
export const answersRole = (entityName: string) => `CanGetDynamicEntityRecord_${entityName}`;

const ANSWERS_ROLE = /^CanGetDynamicEntityRecord_cohort_form_[a-z0-9]+$/;
export const isAnswersRole = (roleName: string) => ANSWERS_ROLE.test(roleName);

function propertyOf(q: Question): Record<string, unknown> {
	const description = q.label || q.label_ar || q.key;
	switch (q.kind) {
		case 'number':
			return { type: 'integer', example: 1, description };
		case 'checkbox':
			return { type: 'boolean', example: true, description };
		case 'date':
			return { type: 'string', maxLength: 10, example: '2027-01-31', description };
		case 'textarea':
			return { type: 'string', maxLength: 4000, example: 'An answer.', description };
		case 'select':
			return { type: 'string', maxLength: 255, example: q.options?.[0]?.en || 'An option', description };
		default:
			return { type: 'string', maxLength: 255, example: 'An answer.', description };
	}
}

/** The dynamic entity a form is published as: who answered, when, and one property per question. */
export function answersDefinition(form: Form, entityName: string, questions: Question[], home = cohortSpace()): SystemDynamicEntityDefinition {
	// The one link out of the forms space, named with its space so it can be followed without knowing Cohort.
	const subject = form.purpose === 'survey'
		? `The id of the cohort_participant answering, in space ${home}.`
		: `The id of the cohort_application these answers belong to, in space ${home}.`;
	return {
		entity_name: entityName,
		has_personal_entity: true,
		personal_requires_role: false,
		has_public_access: false,
		has_community_access: true,
		schema: {
			description: `Answers to the ${form.purpose === 'survey' ? 'survey' : 'application form'} "${form.title || form.title_ar}" (version ${form.version}; the cohort_form ${form.id} in space ${home}).`,
			required: ['subject_id'],
			properties: {
				subject_id: { type: 'string', minLength: 1, maxLength: 36, example: '6fb17583-1e49-4435-bb74-a14fe0996723', description: subject },
				startup_name: { type: 'string', maxLength: 255, example: 'Example Pay', description: 'The startup, as staff see it.' },
				submitted_at: { type: 'string', maxLength: 30, example: '2027-03-01T09:00:00Z', description: 'When the answers were submitted (ISO 8601, UTC); absent while a draft.' },
				...Object.fromEntries(questions.map((q) => [q.key, propertyOf(q)]))
			}
		}
	};
}

/** A form as its record: a save replaces the whole record. */
export function formRecord(form: Form): CohortRecord {
	const record: CohortRecord = {
		purpose: form.purpose,
		title: form.title,
		status: form.status,
		version: form.version,
		questions: JSON.stringify(form.questions)
	};
	for (const key of ['title_ar', 'description', 'description_ar', 'call_id', 'programme_id', 'entity_name', 'dynamic_entity_id', 'published_at', 'replaces_form_id'] as const) {
		if (form[key]) record[key] = form[key];
	}
	return record;
}

export async function listForms(): Promise<Form[]> {
	return (await listRecords(FORM, 'public')).map((r) => formOf(idOf(FORM, r), r));
}

export async function getForm(id: string): Promise<Form> {
	return formOf(id, await getRecord(FORM, 'public', id));
}

/** The call's application form: its newest published version. */
export function applicationFormOf(callId: string, forms: Form[]): Form | null {
	return forms.filter((f) => f.purpose === 'application' && f.call_id === callId && f.status === 'published').sort((a, b) => b.version - a.version)[0] ?? null;
}

export async function saveForm(form: Form, token: string, publishedBy?: string): Promise<void> {
	await updateRecord(FORM, '', form.id, { ...formRecord(form), ...(publishedBy ? { published_by_username: publishedBy } : {}) }, token);
}

/**
 * Publish a form's questions: create its dynamic entity the first time, or add the new questions to it. Runs with
 * the staff member's own token, so a missing Role is OBP-API's refusal, shown to them.
 */
export async function publishDefinition(form: Form, token: string): Promise<{ entity_name: string; dynamic_entity_id: string }> {
	const path = dynamicEntityDefinitionsPath(cohortFormsSpace());
	const definition = answersDefinition(form, form.entity_name, form.questions);
	if (form.dynamic_entity_id) {
		await obpRequests.put(`${path}/${encodeURIComponent(form.dynamic_entity_id)}`, definition, token);
		return { entity_name: form.entity_name, dynamic_entity_id: form.dynamic_entity_id };
	}
	const created = await obpRequests.post(path, definition, token);
	return { entity_name: form.entity_name, dynamic_entity_id: String(created?.dynamic_entity_id ?? '') };
}

export interface AnswersRecord {
	id: string;
	subject_id: string;
	startup_name: string;
	submitted_at: string;
	record: CohortRecord;
}

const answersRecordOf = (entity: string, r: CohortRecord): AnswersRecord => ({
	id: idOf(entity, r),
	subject_id: String(r.subject_id ?? ''),
	startup_name: String(r.startup_name ?? ''),
	submitted_at: String(r.submitted_at ?? ''),
	record: r
});

/** Answers to a published form: the caller's own ('my') or everyone's ('community', with the Get Role). */
export async function answersRecords(form: Form, access: Extract<Access, 'my' | 'community'>, token: string): Promise<AnswersRecord[]> {
	if (!form.entity_name || form.status === 'draft') return [];
	return (await listRecords(form.entity_name, access, token, cohortFormsSpace())).map((r) => answersRecordOf(form.entity_name, r));
}

/** The caller's own answers for this application or participant, if any. */
export async function myAnswers(form: Form, subjectId: string, token: string): Promise<AnswersRecord | null> {
	return (await answersRecords(form, 'my', token)).find((a) => a.subject_id === subjectId) ?? null;
}

/** Write the caller's own answers (only for questions published in the dynamic entity), creating them the first time. */
export async function writeMyAnswers(form: Form, subjectId: string, startupName: string, answers: Answers, submitted: boolean, token: string): Promise<void> {
	const published = new Set(form.questions.filter((q) => q.published).map((q) => q.key));
	const existing = await myAnswers(form, subjectId, token);
	const record: CohortRecord = {
		subject_id: subjectId,
		...(startupName ? { startup_name: startupName } : {}),
		...Object.fromEntries(Object.entries(answers).filter(([k]) => published.has(k))),
		...(submitted ? { submitted_at: nowUtc() } : existing?.submitted_at ? { submitted_at: existing.submitted_at } : {})
	};
	if (existing) await updateRecord(form.entity_name, 'my', existing.id, record, token, cohortFormsSpace());
	else await createRecord(form.entity_name, 'my', record, token, cohortFormsSpace());
}

/**
 * The extra answers on an application, as staff or a reviewer read them: through the community URL of the form's
 * dynamic entity, with their own Get Role on it. Null when the application answered no form.
 */
export async function answersOnApplication(application: CohortRecord, applicationId: string, token: string) {
	const formId = String(application.form_id ?? '');
	if (!formId) return null;
	const form = await getForm(formId).catch(() => null);
	if (!form || form.status === 'draft') return null;
	try {
		const mine = (await answersRecords(form, 'community', token)).find((r) => r.subject_id === applicationId);
		return { questions: form.questions, answers: answersOf(form.questions, mine?.record), lacking: null, error: null };
	} catch (err) {
		const message = messageOf(err);
		const lacking = /OBP-20006|missing/i.test(message) ? { role_name: answersRole(form.entity_name), bank_id: cohortFormsSpace(), requested: false } : null;
		return { questions: form.questions, answers: {}, lacking, error: lacking ? null : message };
	}
}
