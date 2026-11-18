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
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { OBP_ENTITY_SPACE_ID: 'cohort' } }));
const obp = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('./obp', () => ({ obpRequests: obp }));

const { answersDefinition, answersRecords, formRecord, isAnswersRole, publishDefinition, teamAnswers, writeMyAnswers, writeTeamAnswers } = await import('./forms');
const { formOf } = await import('$lib/forms');

const form = formOf('6fb17583-1e49-4435-bb74-a14fe0996723', {
	purpose: 'survey',
	title: 'Mid-programme survey',
	title_ar: 'استبيان منتصف البرنامج',
	programme_id: 'p1',
	status: 'draft',
	questions: JSON.stringify([
		{ key: 'funding_raised', kind: 'number', label: 'Funding raised', label_ar: 'التمويل' },
		{ key: 'pilot', kind: 'checkbox', label: 'Has a pilot', label_ar: '' },
		{ key: 'round', kind: 'select', label: 'Round', label_ar: '', options: [{ en: 'Seed', ar: '' }] }
	])
});

describe('answersDefinition', () => {
	it('is a personal and community dynamic entity with one typed property per question', () => {
		const definition = answersDefinition(form, 'cohort_form_6fb175831e49', form.questions);
		expect(definition).toMatchObject({ entity_name: 'cohort_form_6fb175831e49', has_personal_entity: true, personal_requires_role: false, has_community_access: true, has_public_access: false });
		const properties = definition.schema!.properties as Record<string, { type: string; example: unknown }>;
		expect(Object.keys(properties)).toEqual(['subject_id', 'startup_name', 'submitted_at', 'funding_raised', 'pilot', 'round']);
		expect(properties.funding_raised.type).toBe('integer');
		expect(properties.pilot.type).toBe('boolean');
		expect(properties.round.example).toBe('Seed');
		// OBP-API needs an example on every property.
		expect(Object.values(properties).every((p) => p.example !== undefined)).toBe(true);
	});
	it('uses row-level access for a survey, so each answer can be shared with its team, and not for an application form', () => {
		expect(answersDefinition(form, 'cohort_form_6fb175831e49', form.questions).use_row_level_access).toBe(true);
		const applicationForm = { ...form, purpose: 'application' as const };
		expect(answersDefinition(applicationForm, 'cohort_form_6fb175831e49', form.questions).use_row_level_access).toBeUndefined();
	});
	it('names the space its subject_id points into, so the link can be followed', () => {
		const definition = answersDefinition(form, 'cohort_form_6fb175831e49', form.questions);
		const properties = definition.schema!.properties as Record<string, { description: string }>;
		expect(properties.subject_id.description).toContain('cohort_participant');
		expect(properties.subject_id.description).toContain('in space cohort');
	});
});

describe('formRecord', () => {
	it('keeps the questions as JSON and leaves out empty fields', () => {
		const record = formRecord(form);
		expect(JSON.parse(String(record.questions))).toHaveLength(3);
		expect(record).not.toHaveProperty('call_id');
		expect(record).toMatchObject({ purpose: 'survey', programme_id: 'p1', status: 'draft', version: 1 });
	});
});

describe('isAnswersRole', () => {
	it('is the Get Role on a form dynamic entity, and nothing wider', () => {
		expect(isAnswersRole('CanGetDynamicEntityRecord_cohort_form_6fb175831e49')).toBe(true);
		expect(isAnswersRole('CanGetDynamicEntityRecord_cohort_form')).toBe(false);
		expect(isAnswersRole('CanDeleteDynamicEntityRecord_cohort_form_6fb175831e49')).toBe(false);
		expect(isAnswersRole('CanGetDynamicEntityRecord_cohort_application')).toBe(false);
	});
});

describe('the forms space', () => {
	const published = { ...form, status: 'published' as const, entity_name: 'cohort_form_6fb175831e49', questions: form.questions.map((q) => ({ ...q, published: true })) };

	it('is where a form is published, apart from Cohort\'s space', async () => {
		obp.post.mockResolvedValueOnce({ dynamic_entity_id: 'de1' });
		await publishDefinition(published, 'token');
		expect(obp.post.mock.calls.at(-1)![0]).toBe('/obp/v7.0.0/management/banks/cohort-forms/dynamic-entities');
	});

	it('is where answers are read and written', async () => {
		obp.get.mockResolvedValue({ cohort_form_6fb175831e49_list: [] });
		await answersRecords(published, 'community', 'token');
		expect(obp.get.mock.calls.at(-1)![0]).toContain('/banks/cohort-forms/');
		await writeMyAnswers(published, 'participant-1', 'Example Pay', { funding_raised: 10 }, true, 'token');
		expect(obp.post.mock.calls.at(-1)![0]).toContain('/banks/cohort-forms/');
		expect(obp.post.mock.calls.at(-1)![1]).toMatchObject({ subject_id: 'participant-1', funding_raised: 10 });
	});
});

describe("a team's answers to a survey", () => {
	const published = { ...form, status: 'published' as const, entity_name: 'cohort_form_6fb175831e49', questions: form.questions.map((q) => ({ ...q, published: true })) };
	const participant = { id: 'participant-1', startup_name: 'Example Pay', organisation_id: 'team-a' };
	const accessUrl = (recordId: string) => `/obp/v7.0.0/banks/cohort-forms/dynamic-entities/cohort_form_6fb175831e49/${recordId}/access`;

	it('are read with the member\'s own token, and found by the participant', async () => {
		obp.get.mockResolvedValueOnce({ cohort_form_6fb175831e49_list: [{ cohort_form_6fb175831e49: { cohort_form_6fb175831e49_id: 'r1', subject_id: 'participant-1' } }] });
		expect((await teamAnswers(published, 'participant-1', 'member-token'))?.id).toBe('r1');
		expect(obp.get.mock.calls.at(-1)).toEqual(['/obp/v7.0.0/banks/cohort-forms/dynamic-entities/cohort_form_6fb175831e49', 'member-token']);
	});

	it('are created as the first member\'s record and shared with the team\'s Organisation', async () => {
		obp.get.mockResolvedValueOnce({ cohort_form_6fb175831e49_list: [] });
		obp.post.mockResolvedValueOnce({ cohort_form_6fb175831e49: { cohort_form_6fb175831e49_id: 'new-record' } });
		obp.put.mockResolvedValueOnce({});
		await writeTeamAnswers(published, participant, { funding_raised: 10 }, false, 'member-token');
		expect(obp.post.mock.calls.at(-1)![0]).toBe('/obp/v7.0.0/banks/cohort-forms/dynamic-entities/my/cohort_form_6fb175831e49');
		expect(obp.post.mock.calls.at(-1)![2]).toBe('member-token');
		expect(obp.put.mock.calls.at(-1)).toEqual([accessUrl('new-record'), { organisation_id: 'team-a', can_read: true, can_update: true }, 'member-token']);
	});

	it('show a failure to share a record the member has just created', async () => {
		obp.get.mockResolvedValueOnce({ cohort_form_6fb175831e49_list: [] });
		obp.post.mockResolvedValueOnce({ cohort_form_6fb175831e49: { cohort_form_6fb175831e49_id: 'new-record' } });
		obp.put.mockRejectedValueOnce(new Error('OBP-30646: Organisation not found.'));
		await expect(writeTeamAnswers(published, participant, {}, false, 'member-token')).rejects.toThrow('OBP-30646');
	});

	it('are updated in place by another member, who may not be able to share them again', async () => {
		obp.get.mockResolvedValueOnce({ cohort_form_6fb175831e49_list: [{ cohort_form_6fb175831e49: { cohort_form_6fb175831e49_id: 'r1', subject_id: 'participant-1', submitted_at: '' } }] });
		obp.put.mockResolvedValueOnce({ cohort_form_6fb175831e49: { cohort_form_6fb175831e49_id: 'r1' } });
		obp.put.mockRejectedValueOnce(new Error('OBP-20006: missing grant access on this row'));
		await writeTeamAnswers(published, participant, { pilot: true }, true, 'teammate-token');
		const [updateUrl, updateBody, updateToken] = obp.put.mock.calls.at(-2)!;
		expect(updateUrl).toBe('/obp/v7.0.0/banks/cohort-forms/dynamic-entities/cohort_form_6fb175831e49/r1');
		expect(updateBody).toMatchObject({ subject_id: 'participant-1', pilot: true });
		expect(updateBody.submitted_at).toBeTruthy();
		expect(updateToken).toBe('teammate-token');
		expect(obp.put.mock.calls.at(-1)![0]).toBe(accessUrl('r1'));
	});
});
