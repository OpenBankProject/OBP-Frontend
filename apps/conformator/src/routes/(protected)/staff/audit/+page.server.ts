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
import { fail } from '@sveltejs/kit';
import {
	AUDITED_CENTRAL_ENTITIES,
	AUDITED_PARTICIPANT_ENTITIES,
	checkAllChains,
	conformatorChains,
	GET_ROOT_CHAIN_ROLE,
	rootChain,
	SEAL_ROOT_CHAIN_ROLE,
	sealRootChain,
	type RegisteredChain
} from '$lib/server/auditChains';
import { messageOf } from '$lib/server/errors';
import { roleCheck } from '$lib/server/staffAccess';
import { centralSpace } from '$lib/server/space';
import { userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/** Conformator's chains grouped by space, central space first, each with the audited entities that have no chain there. */
function bySpace(chains: RegisteredChain[]) {
	const central = centralSpace();
	const spaces = new Map<string, RegisteredChain[]>([[central, []]]);
	for (const chain of chains) spaces.set(chain.bank_id, [...(spaces.get(chain.bank_id) ?? []), chain]);
	return [...spaces.entries()].map(([space, spaceChains]) => {
		const expected = space === central ? AUDITED_CENTRAL_ENTITIES : AUDITED_PARTICIPANT_ENTITIES;
		const present = new Set(spaceChains.map((c) => c.entity_name));
		return { space, central: space === central, chains: spaceChains, missing: expected.filter((name) => !present.has(name)) };
	});
}

/**
 * The audit chains of Conformator's decisions: which spaces and entities have one, and the root chain that ties them together. Checking every chain reads every entry and record, so it runs only when asked. Reading needs the system Role CanGetDynamicEntityAuditRootChain; sealing needs CanSealDynamicEntityAuditRootChain.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const can = await roleCheck(token);
	const canRead = can(GET_ROOT_CHAIN_ROLE, '');
	const canSeal = can(SEAL_ROOT_CHAIN_ROLE, '');
	if (!canRead) return { canRead, canSeal, root: null, spaces: [], problem: null };
	try {
		const [root, chains] = await Promise.all([rootChain(token), conformatorChains(token).catch(() => [] as RegisteredChain[])]);
		return { canRead, canSeal, root, spaces: bySpace(chains), problem: null };
	} catch (err) {
		return { canRead, canSeal, root: null, spaces: [], problem: messageOf(err) };
	}
};

export const actions: Actions = {
	/** Check the root chain and every chain in full, records included. */
	check: async ({ locals }) => {
		try {
			const check = await checkAllChains(userToken(locals)!);
			if (!check) return fail(400, { error: 'No audit chain has been started yet, so there is nothing to check.' });
			const chainNames = new Map((await conformatorChains(userToken(locals)!).catch(() => [] as RegisteredChain[])).map((c) => [c.chain_id, `${c.entity_name} in ${c.bank_id}`]));
			return { check: { ...check, problems: check.problems.map((p) => ({ ...p, chain: p.chain_id ? (chainNames.get(p.chain_id) ?? p.chain_id) : null })) } };
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
	},
	/** Seal the root chain, and show the hash to keep outside OBP. */
	seal: async ({ locals }) => {
		try {
			const sealed = await sealRootChain(userToken(locals)!);
			return { sealed: { chains_sealed: sealed.chains_sealed, last_sequence: sealed.root_chain.last_sequence, last_hash: sealed.root_chain.last_hash, sealed_at: new Date().toISOString() } };
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
	}
};
