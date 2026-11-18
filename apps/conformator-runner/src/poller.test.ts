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
import { Poller, spacesOf } from './poller';
import type { EntityRecord, ObpApi } from './obp';
import type { RunDeps } from './run';

describe('spacesOf', () => {
	it('lists each space once, in order, leaving out empty ones', () => {
		expect(spacesOf([{ space_id: 'b' }, { space_id: 'a' }, { space_id: 'b' }, {}])).toEqual(['a', 'b']);
	});
});

describe('Poller', () => {
	function setUp(runs: Record<string, EntityRecord[] | Error>) {
		const declared: number[] = [];
		const started: string[] = [];
		const obp: ObpApi = {
			list: async (entity, space) => {
				if (entity === 'conformator_participant') return Object.keys(runs).map((space_id) => ({ space_id }));
				const r = runs[space];
				if (r instanceof Error) throw r;
				return r;
			},
			// The run never finishes in these tests: the first write (marking it running) waits for ever.
			update: async (_e, _s, id) => (started.push(id), new Promise(() => {})),
			get: async () => ({}),
			create: async (_e, _s, body) => body,
			declarePlatformApp: async (scopes) => (declared.push(scopes.length), 'accepted'),
			consumerId: async () => 'runner-consumer'
		};
		const deps = { obp, centralSpace: 'conformator', version: 't', now: () => 'now' } as unknown as RunDeps;
		return { declared, started, deps };
	}

	it('starts queued runs only, up to the limit, and declares Scopes for every space', async () => {
		const { declared, started, deps } = setUp({
			'space-a': [
				{ conformator_run_id: 'r1', status: 'queued' },
				{ conformator_run_id: 'r2', status: 'finished' },
				{ conformator_run_id: 'r3', status: 'queued' }
			],
			'space-b': [{ conformator_run_id: 'r4', status: 'queued' }]
		});
		const poller = new Poller(deps, 2, 1000);
		await poller.pass();
		await new Promise((r) => setTimeout(r, 0));
		expect(started).toEqual(['r1', 'r3']);
		// One central Scope and four in each of the two spaces.
		expect(declared).toEqual([9]);
	});

	it('does not start the same run twice', async () => {
		const { started, deps } = setUp({ 'space-a': [{ conformator_run_id: 'r1', status: 'queued' }] });
		const poller = new Poller(deps, 5, 1000);
		await poller.pass();
		await poller.pass();
		await new Promise((r) => setTimeout(r, 0));
		expect(started).toEqual(['r1']);
	});

	it('goes on to other spaces when one cannot be read', async () => {
		const { started, deps } = setUp({ 'space-a': new Error('OBP-20006: missing Role'), 'space-b': [{ conformator_run_id: 'r9', status: 'queued' }] });
		await new Poller(deps, 2, 1000).pass();
		await new Promise((r) => setTimeout(r, 0));
		expect(started).toEqual(['r9']);
	});
});
