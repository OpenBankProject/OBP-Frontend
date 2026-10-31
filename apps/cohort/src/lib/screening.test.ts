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
import { applicantMayEdit, decisionsFor, isDecision, latestDecision, nowUtc } from './screening';

const decisions = [
	{ application_id: 'a1', decision: 'needs_info', decided_at: '2026-11-21T10:00:00Z' },
	{ application_id: 'a1', decision: 'shortlisted', decided_at: '2026-11-25T10:00:00Z' },
	{ application_id: 'a2', decision: 'rejected', decided_at: '2026-11-26T10:00:00Z' }
];

describe('decisions', () => {
	it('lists an application decisions newest first, and the latest is the outcome', () => {
		expect(decisionsFor('a1', decisions).map((d) => d.decision)).toEqual(['shortlisted', 'needs_info']);
		expect(latestDecision('a1', decisions)?.decision).toBe('shortlisted');
		expect(latestDecision('none', decisions)).toBeUndefined();
	});
	it('knows the decisions', () => {
		expect(isDecision('needs_info')).toBe(true);
		expect(isDecision('accepted')).toBe(false);
	});
});

describe('applicantMayEdit', () => {
	const submitted = { status: 'submitted', submitted_at: '2026-11-20T10:00:00Z' };
	it('allows a draft, refuses a submitted application', () => {
		expect(applicantMayEdit({ status: 'draft' }, undefined)).toBe(true);
		expect(applicantMayEdit(submitted, undefined)).toBe(false);
	});
	it('reopens a submitted application when more information was asked for after it was submitted', () => {
		expect(applicantMayEdit(submitted, { decision: 'needs_info', decided_at: '2026-11-21T10:00:00Z' })).toBe(true);
		expect(applicantMayEdit({ ...submitted, submitted_at: '2026-11-22T10:00:00Z' }, { decision: 'needs_info', decided_at: '2026-11-21T10:00:00Z' })).toBe(false);
		expect(applicantMayEdit(submitted, { decision: 'shortlisted', decided_at: '2026-11-21T10:00:00Z' })).toBe(false);
	});
});

describe('nowUtc', () => {
	it('is ISO 8601 UTC to the second', () => {
		expect(nowUtc(new Date('2026-11-20T10:00:00.123Z'))).toBe('2026-11-20T10:00:00Z');
	});
});
