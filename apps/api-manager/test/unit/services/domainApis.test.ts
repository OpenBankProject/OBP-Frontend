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

// The Domain API form refuses what OBP-API's DomainApiPaths would refuse, so a bad base path or
// version is reported before the request is sent. OBP still has the final say.
import { describe, it, expect } from 'vitest';
import { basePathProblem, versionProblem, majorOf, domainApisPath, spaceOf } from '$lib/services/domainApis';

describe('basePathProblem', () => {
	it('accepts two to five lowercase segments ending vN', () => {
		expect(basePathProblem('carbon-registry/v1')).toBe('');
		expect(basePathProblem('eu/carbon.registry/data/v12')).toBe('');
	});
	it('refuses a single segment or more than five', () => {
		expect(basePathProblem('v1')).not.toBe('');
		expect(basePathProblem('a/b/c/d/e/v1')).not.toBe('');
	});
	it('refuses upper case, a leading slash and an empty segment', () => {
		expect(basePathProblem('Carbon/v1')).not.toBe('');
		expect(basePathProblem('/carbon/v1')).not.toBe('');
		expect(basePathProblem('carbon//v1')).not.toBe('');
	});
	it('refuses a first segment OBP serves', () => {
		expect(basePathProblem('obp/v1')).toContain('obp');
		expect(basePathProblem('banks/v1')).toContain('banks');
	});
	it('needs the major version last', () => {
		expect(basePathProblem('carbon/registry')).toContain('vN');
		expect(basePathProblem('carbon/v01')).toContain('vN');
	});
});

describe('versionProblem', () => {
	it('accepts MAJOR.MINOR.PATCH matching the base path', () => {
		expect(versionProblem('1.2.3', 'carbon/v1')).toBe('');
	});
	it('refuses a major that differs from the base path', () => {
		expect(versionProblem('2.0.0', 'carbon/v1')).toContain('1');
	});
	it('refuses anything that is not semantic', () => {
		expect(versionProblem('1.0', 'carbon/v1')).not.toBe('');
		expect(versionProblem('v1.0.0', 'carbon/v1')).not.toBe('');
		expect(versionProblem('01.0.0', 'carbon/v1')).not.toBe('');
	});
	it('reads the major from the base path', () => {
		expect(majorOf('carbon/v3')).toBe(3);
		expect(majorOf('carbon/registry')).toBeNull();
	});
});

describe('domainApisPath', () => {
	it('uses SYS when no bank id is given', () => {
		expect(spaceOf(null)).toBe('SYS');
		expect(domainApisPath('')).toBe('/obp/v7.0.0/management/banks/SYS/domain-apis');
	});
	it('names one Domain API of a bank', () => {
		expect(domainApisPath('gh.29.uk', 'abc')).toBe('/obp/v7.0.0/management/banks/gh.29.uk/domain-apis/abc');
	});
});
