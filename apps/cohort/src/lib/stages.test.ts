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
import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGES, nextStage, parseStages, stageKeyFor } from './stages';

describe('nextStage', () => {
	const base = { stage: 'onboarded', company_registered: false, milestones_accepted: 0, milestones_total: 2 };

	it('starts the programme only once the company is registered (the default stages)', () => {
		expect(nextStage(base)).toEqual({ to: 'in_programme', missing: [{ kind: 'company' }] });
		expect(nextStage({ ...base, company_registered: true })).toEqual({ to: 'in_programme', missing: [] });
	});

	it('graduates only once every milestone is accepted (the default stages)', () => {
		const inProgramme = { ...base, stage: 'in_programme', company_registered: true };
		expect(nextStage({ ...inProgramme, milestones_accepted: 1 })).toEqual({ to: 'graduated', missing: [{ kind: 'milestones', need: 'all' }] });
		expect(nextStage({ ...inProgramme, milestones_accepted: 2 })).toEqual({ to: 'graduated', missing: [] });
	});

	it('has nowhere to go after graduating, or from a stage the programme does not have', () => {
		expect(nextStage({ ...base, stage: 'graduated' })).toEqual({ to: null, missing: [] });
		expect(nextStage({ ...base, stage: 'withdrawn' })).toEqual({ to: null, missing: [] });
	});

	it("follows a programme's own stages and gates", () => {
		const stages = parseStages([
			{ name: 'Pilot', name_ar: 'تجربة', gate: { company: true, milestones: 2 } },
			{ name: 'Demo day ready', gate: { sessions: 3 } },
			{ key: 'graduated', gate: { milestones: 'all' } }
		]);
		expect(stages.map((s) => s.key)).toEqual(['pilot', 'demo_day_ready', 'graduated']);
		const p = { stage: 'onboarded', company_registered: true, milestones_accepted: 1, milestones_total: 4, sessions_attended: 0 };
		expect(nextStage(p, stages)).toEqual({ to: 'pilot', missing: [{ kind: 'milestones', need: 2 }] });
		expect(nextStage({ ...p, stage: 'pilot' }, stages)).toEqual({ to: 'demo_day_ready', missing: [{ kind: 'sessions', need: 3 }] });
		expect(nextStage({ ...p, stage: 'demo_day_ready', sessions_attended: 3, milestones_accepted: 4 }, stages)).toEqual({ to: 'graduated', missing: [] });
	});
});

describe('parseStages', () => {
	it('gives the default for nothing or something unreadable', () => {
		expect(parseStages('')).toBe(DEFAULT_STAGES);
		expect(parseStages('not json')).toBe(DEFAULT_STAGES);
		expect(parseStages('[]')).toBe(DEFAULT_STAGES);
	});

	it('always ends with graduated, once, drops unnamed stages and makes keys unique', () => {
		const stages = parseStages(
			JSON.stringify([{ key: 'graduated', gate: {} }, { name: 'Build' }, { name: 'Build' }, { name: '' }, { key: 'graduated' }])
		);
		expect(stages.map((s) => s.key)).toEqual(['build', 'build_2', 'graduated']);
	});

	it('keeps a stage\'s saved key when it is renamed, so its participants stay at it', () => {
		const stages = parseStages([{ key: 'pilot', name: 'Pilot with a partner' }, { key: 'pilot', name: 'Pilot again' }, { key: 'Bad Key', name: 'Scale' }, { key: 'onboarded', name: 'Start' }]);
		expect(stages.map((s) => s.key)).toEqual(['pilot', 'pilot_again', 'scale', 'start', 'graduated']);
	});

	it('reads gates carefully', () => {
		const [stage] = parseStages([{ name: 'X', gate: { company: 'yes', milestones: -1, sessions: 2.5 } }]);
		expect(stage.gate).toEqual({ company: false, milestones: 'none', sessions: 0 });
	});
});

describe('stageKeyFor', () => {
	it('makes a key from a name, never onboarded and never one taken', () => {
		expect(stageKeyFor('Demo Day!', [])).toBe('demo_day');
		expect(stageKeyFor('Onboarded', [])).toBe('onboarded_2');
		expect(stageKeyFor('تجربة', ['stage'])).toBe('stage_2');
	});
});
