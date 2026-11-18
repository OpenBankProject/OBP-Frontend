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
import { describe, expect, it } from 'vitest';
import { currentStage, nextStages } from './participants';

describe('currentStage', () => {
	it('is null before any decision', () => {
		expect(currentStage([])).toBeNull();
	});

	it('is the stage of the latest decision, whatever the order read', () => {
		expect(
			currentStage([
				{ stage: 'testing', decided_at: '2026-11-03T10:00:00Z' },
				{ stage: 'admitted', decided_at: '2026-11-01T10:00:00Z' },
				{ stage: 'onboarding', decided_at: '2026-11-02T10:00:00Z' }
			])
		).toBe('testing');
	});

	it('uses when a decision was recorded when it has no decision time', () => {
		expect(
			currentStage([
				{ stage: 'admitted', created_at: '2026-11-01T10:00:00Z' },
				{ stage: 'suspended', created_at: '2026-11-05T10:00:00Z' }
			])
		).toBe('suspended');
	});

	it('skips a decision with an unknown stage', () => {
		expect(
			currentStage([
				{ stage: 'admitted', decided_at: '2026-11-01T10:00:00Z' },
				{ stage: 'promoted', decided_at: '2026-11-09T10:00:00Z' }
			])
		).toBe('admitted');
	});
});

describe('nextStages', () => {
	it('allows only admission first', () => {
		expect(nextStages(null)).toEqual(['admitted']);
	});

	it('allows nothing after exit', () => {
		expect(nextStages('exited')).toEqual([]);
	});

	it('allows only remediation or exit after suspension', () => {
		expect(nextStages('suspended')).toEqual(['remediation', 'exited']);
	});

	it('never offers admission again, nor the current stage', () => {
		expect(nextStages('testing')).toEqual(['onboarding', 'remediation', 'graduated', 'suspended', 'exited']);
	});
});
