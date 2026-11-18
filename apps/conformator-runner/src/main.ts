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
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readConfig } from './config';
import { loadCredentials } from './credentials';
import { send } from './http';
import { log } from './log';
import { obpApi } from './obp';
import { openIdSuite } from './openid';
import { Poller } from './poller';

declare const __RUNNER_VERSION__: string;
const version = typeof __RUNNER_VERSION__ === 'string' ? __RUNNER_VERSION__ : 'dev';

const { config, problems } = readConfig(process.env);
if (problems.length) {
	for (const problem of problems) log.error(problem);
	log.error('OBP-Conformator-Runner cannot start until these settings are fixed. See .env.example.');
	process.exit(1);
}

/** The OpenID conformance suite, when OPENID_SUITE_URL is set; its CA file is read once, at start. */
const suite = config.openIdSuite
	? openIdSuite(
			{
				baseUrl: config.openIdSuite.baseUrl,
				token: config.openIdSuite.token,
				ca: config.openIdSuite.caFile ? readFileSync(config.openIdSuite.caFile, 'utf8') : undefined,
				moduleTimeoutMs: config.openIdSuite.moduleTimeoutMs
			},
			send
		)
	: null;

const poller = new Poller(
	{
		obp: obpApi(config),
		centralSpace: config.centralSpace,
		send,
		credentials: (systemId) => loadCredentials(config.credentialsDir, systemId),
		timeoutMs: config.requestTimeoutMs,
		sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		newId: randomUUID,
		now: () => new Date().toISOString(),
		fetchText: async (url) => {
			const response = await fetch(url, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
			if (!response.ok) throw new Error(`it answered ${response.status}`);
			return response.text();
		},
		openIdSuite: suite,
		version
	},
	config.concurrency,
	config.pollSeconds * 1000
);

log.info(
	`OBP-Conformator-Runner ${version} started: central space ${config.centralSpace}, OBP-API ${config.obpBaseUrl}, ` +
		`looking for runs every ${config.pollSeconds} seconds, ${config.concurrency} at once` +
		(suite ? `, with the OpenID conformance suite at ${config.openIdSuite!.baseUrl}.` : ', without the OpenID conformance suite.')
);
poller.start();

for (const signal of ['SIGTERM', 'SIGINT'] as const)
	process.on(signal, async () => {
		log.info(`${signal}: finishing the runs in progress, then stopping.`);
		await poller.stop();
		process.exit(0);
	});
