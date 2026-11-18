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
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAMPLE_OPENAPI, EXAMPLE_TESTS } from '@obp/shared/conformator';
import { schemaChecker } from './schema';
import { send } from './http';
import { systemClientToken } from './run';
import { runTest } from './steps';
import { makeTestCertificates } from './testCertificates';

const certs = makeTestCertificates();
const PORT = 18443 + Math.floor(Math.random() * 1000);
let bank: ChildProcess | null = null;

/** Start dev/fake-bank.mjs with the test certificates, and wait until it listens. */
async function startBank(env: Record<string, string> = {}) {
	bank = spawn(process.execPath, [join(__dirname, '..', 'dev', 'fake-bank.mjs')], {
		env: { ...process.env, FAKE_BANK_CERTS: certs.dir, FAKE_BANK_PORT: String(PORT), ...env },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	await new Promise<void>((resolve, reject) => {
		bank!.stdout!.on('data', (d: Buffer) => d.toString().includes('Fake bank on') && resolve());
		bank!.on('exit', (code) => reject(new Error(`The fake bank stopped (${code}).`)));
	});
}

afterEach(() => {
	bank?.kill();
	bank = null;
});

const system = {
	base_url: `https://localhost:${PORT}/open-banking/v1`,
	discovery_url: `https://localhost:${PORT}/.well-known/openid-configuration`,
	runner_client_id: 'conformator-runner'
};
const tls = { cert: certs.clientCert, key: certs.clientKey, ca: certs.ca };

async function runExample(testId: string) {
	const test = EXAMPLE_TESTS.find((t) => t.test_id === testId)!;
	let n = 0;
	return runTest(test.definition!, {
		baseUrl: system.base_url,
		tls,
		send,
		timeoutMs: 5000,
		clientToken: () => systemClientToken(system, { tls }, { send, timeoutMs: 5000 }),
		customerToken: 'demo-customer-token',
		sleep: async () => {},
		newId: () => `t-${++n}`,
		schemaCheck: schemaChecker(EXAMPLE_OPENAPI)
	});
}

describe('the example suite against the fake bank, over mTLS', () => {
	it('passes every automated test', async () => {
		await startBank();
		for (const test of EXAMPLE_TESTS.filter((t) => t.kind === 'automated')) {
			const outcome = await runExample(test.test_id);
			expect(outcome.outcome, `${test.test_id}: ${outcome.actual}`).toBe('pass');
		}
	}, 30_000);

	it('fails the balance test against the schema when the bank gives two decimals', async () => {
		await startBank({ FAKE_BANK_BREAK: 'balance-decimals' });
		const outcome = await runExample('DEMO-ACCOUNT-001');
		expect(outcome.outcome).toBe('fail');
		expect(outcome.actual).toContain('Expected the body to match #/components/schemas/Balance: /data/amount');
	}, 30_000);

	it('fails the consent test, saying why, when the bank gets the status wrong', async () => {
		await startBank({ FAKE_BANK_BREAK: 'consent-status' });
		const outcome = await runExample('DEMO-CONSENT-001');
		expect(outcome.outcome).toBe('fail');
		expect(outcome.actual).toContain('Expected /data/status to be "AwaitingAuthorisation", got "Authorised".');
	}, 30_000);
});
