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

vi.mock('./obp', () => ({ obpRequests: { get: vi.fn() } }));

const { apiManagerUrlFrom, createBankUrl, platformAppsUrl } = await import('./appDirectory');

describe('apiManagerUrlFrom', () => {
	it('reads the app directory', () => {
		expect(apiManagerUrlFrom({ public_obp_api_manager_url: 'http://localhost:3003/' })).toBe('http://localhost:3003');
	});
	it('is none when the app directory has no entry for it', () => {
		expect(apiManagerUrlFrom({})).toBeNull();
	});
});

describe('platformAppsUrl', () => {
	it('links to Platform Apps with the consumer_id and a label', () => {
		expect(platformAppsUrl('http://localhost:3003', 'c-1')).toBe(
			'http://localhost:3003/consumers/platform-apps?consumer_id=c-1&label=OBP-Cohort'
		);
	});
});

describe('createBankUrl', () => {
	it('links to Create Bank with the space filled in', () => {
		expect(createBankUrl('http://localhost:3003', 'cohort')).toBe(
			'http://localhost:3003/banks/create?bank_id=cohort&full_name=OBP-Cohort&bank_code=COHORT'
		);
	});
});
