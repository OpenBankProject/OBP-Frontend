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
import { runnerCentralScopes, runnerSpaceScopes } from '@obp/shared/conformator';
import { log } from './log';
import { ObpError, type EntityRecord } from './obp';
import { processRun, RUN, type RunDeps } from './run';

const PARTICIPANT = 'conformator_participant';
const DECLARE_EVERY_MS = 10 * 60 * 1000;

/** The participants' spaces, from the participant register in the central space. */
export function spacesOf(participants: EntityRecord[]): string[] {
	return [...new Set(participants.map((p) => String(p.space_id ?? '')).filter(Boolean))].sort();
}

/**
 * Look for queued runs and run them, up to `concurrency` at once. Each pass reads the participant register, declares
 * the runner's Scopes to OBP-API when the list of spaces changes (and every ten minutes), then starts queued runs in
 * each space while there is room. A space whose runs cannot be read is reported once until that changes.
 */
export class Poller {
	private readonly running = new Set<string>();
	private declaredFor = '';
	private declaredAt = 0;
	private readonly unreadable = new Map<string, string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private stopping = false;

	constructor(
		private readonly deps: RunDeps,
		private readonly concurrency: number,
		private readonly pollMs: number
	) {}

	private consumerLogged = false;

	/** One pass. Exposed for tests; start() repeats it. */
	async pass(): Promise<void> {
		const { obp, centralSpace } = this.deps;
		if (!this.consumerLogged) {
			try {
				log.info(`The runner's consumer_id is ${await obp.consumerId()}. Set it as CONFORMATOR_RUNNER_CONSUMER_ID in the web app.`);
				this.consumerLogged = true;
			} catch (err) {
				log.warn(`The runner's consumer_id could not be read: ${(err as Error).message}`);
			}
		}
		let spaces: string[];
		try {
			spaces = spacesOf(await obp.list(PARTICIPANT, centralSpace));
		} catch (err) {
			const notThere = err instanceof ObpError && err.status === 404;
			log.warn(
				notThere
					? `The participant register does not exist in ${centralSpace} yet. Start the web app, which creates it, and check its /setup page.`
					: `The participant register in ${centralSpace} could not be read: ${(err as Error).message}`
			);
			return;
		}
		await this.declare(spaces);
		for (const space of spaces) {
			if (this.stopping || this.running.size >= this.concurrency) return;
			let runs: EntityRecord[];
			try {
				runs = await obp.list(RUN, space);
				this.unreadable.delete(space);
			} catch (err) {
				const message = (err as Error).message;
				if (this.unreadable.get(space) !== message) log.warn(`The runs in ${space} could not be read: ${message}`);
				this.unreadable.set(space, message);
				continue;
			}
			for (const run of runs.filter((r) => r.status === 'queued')) {
				if (this.stopping || this.running.size >= this.concurrency) return;
				const id = String(run[`${RUN}_id`]);
				if (this.running.has(id)) continue;
				this.running.add(id);
				log.info(`Run ${id} in ${space} started.`);
				void processRun(space, run, this.deps)
					.then((status) => log.info(`Run ${id} in ${space} ended: ${status}.`))
					.catch((err) => log.error(`Run ${id} in ${space} could not be started: ${(err as Error).message}`))
					.finally(() => this.running.delete(id));
			}
		}
	}

	private async declare(spaces: string[]): Promise<void> {
		const key = spaces.join(',');
		if (key === this.declaredFor && Date.now() - this.declaredAt < DECLARE_EVERY_MS) return;
		const scopes = [...runnerCentralScopes(this.deps.centralSpace), ...spaces.flatMap(runnerSpaceScopes)];
		const answer = await this.deps.obp.declarePlatformApp(scopes, this.deps.version);
		log.info(`Platform App declaration of ${scopes.length} Scopes for ${spaces.length} participant spaces: ${answer}.`);
		this.declaredFor = key;
		this.declaredAt = Date.now();
	}

	start(): void {
		const loop = async () => {
			await this.pass().catch((err) => log.error(`A pass failed: ${(err as Error).message}`));
			if (!this.stopping) this.timer = setTimeout(loop, this.pollMs);
		};
		void loop();
	}

	/** Stop looking for runs, and wait for the ones running to end. */
	async stop(): Promise<void> {
		this.stopping = true;
		if (this.timer) clearTimeout(this.timer);
		while (this.running.size > 0) await new Promise((r) => setTimeout(r, 200));
	}
}
