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
import { decisionEmail, fill, submittedEmail } from './emails';

const values = { site: 'Cohort', call: 'Cohort 1', startup: 'Example Pay', link: 'https://cohort.example.com/applications/a1' };

describe('applicant emails', () => {
	it('fills placeholders and leaves unknown ones', () => {
		expect(fill('{a} and {b}', { a: 'x' })).toBe('x and {b}');
	});

	it('confirms a submission in English and Arabic, with a one-line subject', () => {
		const email = submittedEmail(values);
		expect(email.subject).toContain('Cohort 1');
		expect(email.subject).not.toMatch(/[\r\n]/);
		expect(email.text).toContain('Example Pay');
		expect(email.text).toContain(values.link);
		expect(email.text).toMatch(/[؀-ۿ]/);
	});

	it('tells the outcome and the message for the applicant', () => {
		const email = decisionEmail({ ...values, decision: 'needs_info', message: 'Please add your team size.' });
		expect(email.text).toContain('More information needed');
		expect(email.text).toContain('Please add your team size.');
	});

	it('never puts a newline from a call title into the subject', () => {
		expect(submittedEmail({ ...values, call: 'Two\nlines' }).subject).not.toMatch(/[\r\n]/);
	});
});
