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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./obp', () => ({
	obpRequests: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) }
}));

import { checkAllChains, conformatorChains, rootChain, startAuditChains } from './auditChains';

const ENTITIES_PATH = '/obp/v7.0.0/management/banks/conformator-acme/dynamic-entities';

beforeEach(() => {
	get.mockReset();
	post.mockReset();
});

describe('startAuditChains', () => {
	it("starts each entity's chain by its dynamic entity id, in that entity's space", async () => {
		get.mockResolvedValueOnce({ dynamic_entities: [{ entity_name: 'conformator_assessment', dynamic_entity_id: 'de-1' }] });
		post.mockResolvedValueOnce({ chain_id: 'c-1' });
		expect(await startAuditChains('conformator-acme', ['conformator_assessment'], 'token')).toEqual({ conformator_assessment: true });
		expect(get).toHaveBeenCalledWith(ENTITIES_PATH, 'token');
		expect(post).toHaveBeenCalledWith(`${ENTITIES_PATH}/de-1/audit-chain`, {}, 'token');
	});

	it('counts a chain started before as started', async () => {
		get.mockResolvedValueOnce({ dynamic_entities: [{ entity_name: 'conformator_approval', dynamic_entity_id: 'de-2' }] });
		post.mockRejectedValueOnce(new Error("OBP-09042: This Dynamic Entity's audit chain has already been started."));
		expect(await startAuditChains('conformator-acme', ['conformator_approval'], 'token')).toEqual({ conformator_approval: true });
	});

	it('counts a refusal, or an entity that does not exist yet, as not started, and goes on with the others', async () => {
		get.mockResolvedValueOnce({
			dynamic_entities: [
				{ entity_name: 'conformator_assessment', dynamic_entity_id: 'de-1' },
				{ entity_name: 'conformator_approval', dynamic_entity_id: 'de-2' }
			]
		});
		post.mockRejectedValueOnce(new Error('OBP-20006: User is missing one or more roles: CanCreateDynamicEntityAuditChain')).mockResolvedValueOnce({});
		expect(await startAuditChains('conformator-acme', ['conformator_assessment', 'conformator_approval', 'conformator_appeal'], 'token')).toEqual({
			conformator_assessment: false,
			conformator_approval: true,
			conformator_appeal: false
		});
		expect(post).toHaveBeenCalledTimes(2);
	});

	it('asks nothing without a token', async () => {
		expect(await startAuditChains('conformator-acme', ['conformator_approval'], null)).toEqual({ conformator_approval: false });
		expect(get).not.toHaveBeenCalled();
	});
});

describe('the root chain', () => {
	it('is null, not an error, before any chain is started', async () => {
		get.mockRejectedValue(new Error('OBP-09045: There is no root audit chain yet.'));
		expect(await rootChain('token')).toBeNull();
		expect(await checkAllChains('token')).toBeNull();
	});

	it('is checked with every chain in it', async () => {
		get.mockResolvedValueOnce({ is_intact: true, problems: [] });
		await checkAllChains('token');
		expect(get).toHaveBeenCalledWith('/obp/v7.0.0/management/dynamic-entity-audit-chains/root/check?include_chains=true', 'token');
	});
});

describe('conformatorChains', () => {
	it("lists Conformator's chains from the root chain's CHAIN_STARTED entries, leaving out other apps' chains", async () => {
		get.mockResolvedValueOnce({
			entries: [
				{ sequence: 0, operation: 'STARTED', record_id: 'root' },
				{ sequence: 1, operation: 'CHAIN_STARTED', record_id: 'c-1', recorded_at: '2026-11-25T10:00:00Z', data: { bank_id: 'conformator', entity_name: 'conformator_report' } },
				{ sequence: 2, operation: 'CHAIN_STARTED', record_id: 'c-2', data: { bank_id: 'other', entity_name: 'invoice' } },
				{ sequence: 3, operation: 'CHAIN_HEAD', record_id: 'c-1', data: { last_sequence: 4 } }
			]
		});
		expect(await conformatorChains('token')).toEqual([{ chain_id: 'c-1', bank_id: 'conformator', entity_name: 'conformator_report', started_at: '2026-11-25T10:00:00Z' }]);
	});

	it('reads the next page while a page comes back full', async () => {
		const full = Array.from({ length: 1000 }, (_, i) => ({ sequence: i, operation: 'CHAIN_HEAD', record_id: 'c' }));
		get.mockResolvedValueOnce({ entries: full }).mockResolvedValueOnce({ entries: [] });
		await conformatorChains('token');
		expect(get).toHaveBeenNthCalledWith(2, '/obp/v7.0.0/management/dynamic-entity-audit-chains/root/entries?from_sequence=1000&limit=1000', 'token');
	});
});
