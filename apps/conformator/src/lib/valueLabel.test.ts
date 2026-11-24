/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
 */
import { describe, expect, it } from 'vitest';
import { OUTCOMES, SYSTEM_ROLES, API_FAMILIES, SUITE_STATUSES, SEVERITIES, TEST_KINDS, PARTICIPANT_CATEGORIES, PARTICIPANT_STAGES, RUN_STATUSES, BLOCKED_BY } from '@obp/shared/conformator';
import { valueLabel } from './valueLabel';

describe('valueLabel', () => {
	it('has a label for every value in the vocabulary', () => {
		const values = [OUTCOMES, SYSTEM_ROLES, API_FAMILIES, SUITE_STATUSES, SEVERITIES, TEST_KINDS, PARTICIPANT_CATEGORIES, PARTICIPANT_STAGES, RUN_STATUSES, BLOCKED_BY].flat();
		// English labels are the values with spaces; outside a request the page language is English
		expect(values.filter((value) => valueLabel(value) !== value.replaceAll('_', ' '))).toEqual([]);
	});

	it('shows a value it has no label for with spaces', () => {
		expect(valueLabel('some_new_value')).toBe('some new value');
	});
});
