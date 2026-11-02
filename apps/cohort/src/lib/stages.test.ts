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
import { nextStage } from './stages';

describe('nextStage', () => {
	const base = { stage: 'onboarded', company_registered: false, milestones_accepted: 0, milestones_total: 2 };

	it('starts the programme only once the company is registered', () => {
		expect(nextStage(base)).toEqual({ to: 'in_programme', missing: 'company' });
		expect(nextStage({ ...base, company_registered: true })).toEqual({ to: 'in_programme', missing: null });
	});

	it('graduates only once every milestone is accepted', () => {
		const inProgramme = { ...base, stage: 'in_programme', company_registered: true };
		expect(nextStage({ ...inProgramme, milestones_accepted: 1 })).toEqual({ to: 'graduated', missing: 'milestones' });
		expect(nextStage({ ...inProgramme, milestones_accepted: 2 })).toEqual({ to: 'graduated', missing: null });
	});

	it('has nowhere to go after graduating, or from an unknown stage', () => {
		expect(nextStage({ ...base, stage: 'graduated' })).toEqual({ to: null, missing: null });
		expect(nextStage({ ...base, stage: 'withdrawn' })).toEqual({ to: null, missing: null });
	});
});
