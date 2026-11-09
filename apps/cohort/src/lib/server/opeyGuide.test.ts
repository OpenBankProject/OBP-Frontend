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

const { opeyGuide } = await import('./opeyGuide');

describe('opeyGuide', () => {
	const guide = opeyGuide();
	const base = '/obp/v7.0.0/banks/cohort/dynamic-entities';

	it("names Cohort's bank_id and the forms space", () => {
		expect(guide).toContain('dynamic entities at bank_id "cohort"');
		expect(guide).toContain('cohort_form_<id> at bank_id "cohort-forms"');
	});

	it('says how each dynamic entity is read, by its access', () => {
		expect(guide).toContain(`- cohort_call: `);
		expect(guide).toContain(`anyone: GET ${base}/public/cohort_call`);
		expect(guide).toContain(`the user's own records: GET ${base}/my/cohort_application`);
		expect(guide).toContain(
			`every user's records (needs CanGetDynamicEntityRecord_cohort_application at bank_id cohort): GET ${base}/community/cohort_application`
		);
		expect(guide).toContain(
			`staff only (needs CanGetDynamicEntityRecord_cohort_participant at bank_id cohort): GET ${base}/cohort_participant`
		);
	});

	it('points questions about programmes, calls and applications at their dynamic entities', () => {
		expect(guide).toContain('Answer questions about programmes, calls and applications from the records of those dynamic entities');
		expect(guide).toContain('- Programmes (');
		expect(guide).toContain('- Calls for applications (');
		expect(guide).toContain('- Applications (');
		expect(guide).toContain('cohort_screening_decision whose application_id');
	});

	it("leaves out Opey's own conversations", () => {
		expect(guide).not.toContain('cohort_opey_conversation');
	});
});

describe('cohortOpeyPrompt', () => {
	it("puts the installation's own focus before the guide", async () => {
		const { env } = await import('$env/dynamic/private');
		(env as Record<string, string>).OPEY_APP_SUPPLEMENTARY_PROMPT = 'Answer as the programme office of Example Hub.';
		const { cohortOpeyPrompt } = await import('./opeyGuide');
		const prompt = cohortOpeyPrompt();
		expect(prompt.startsWith('Answer as the programme office of Example Hub.\n\n')).toBe(true);
		expect(prompt).toContain('dynamic entities at bank_id "cohort"');
		delete (env as Record<string, string>).OPEY_APP_SUPPLEMENTARY_PROMPT;
		expect(cohortOpeyPrompt().startsWith('You are helping people use Cohort')).toBe(true);
	});
});
