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
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSafeId, loadCredentials } from './credentials';

async function folderWith(files: Record<string, string>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'runner-credentials-'));
	await mkdir(join(dir, 'sys1'));
	for (const [name, text] of Object.entries(files)) await writeFile(join(dir, 'sys1', name), text);
	return dir;
}

describe('loadCredentials', () => {
	it('is empty for a system with no folder', async () => {
		const dir = await folderWith({});
		expect(await loadCredentials(dir, 'other')).toEqual({});
	});

	it('reads the certificate, key, CA and secrets', async () => {
		const dir = await folderWith({
			'client.crt': 'CERT',
			'client.key': 'KEY',
			'ca.crt': 'CA',
			'secrets.json': JSON.stringify({ client_secret: 's', customer_access_token: 't', scope: '' })
		});
		expect(await loadCredentials(dir, 'sys1')).toEqual({
			tls: { cert: 'CERT', key: 'KEY', ca: 'CA' },
			clientSecret: 's',
			clientId: undefined,
			tokenEndpoint: undefined,
			scope: undefined,
			customerAccessToken: 't'
		});
	});

	it('refuses a certificate without its key', async () => {
		const dir = await folderWith({ 'client.crt': 'CERT' });
		await expect(loadCredentials(dir, 'sys1')).rejects.toThrow(/client.crt but no client.key/);
	});

	it('refuses a broken secrets.json', async () => {
		const dir = await folderWith({ 'secrets.json': '{' });
		await expect(loadCredentials(dir, 'sys1')).rejects.toThrow(/not valid JSON/);
	});

	it('refuses an id that could leave the folder', async () => {
		await expect(loadCredentials('/tmp', '../etc')).rejects.toThrow(/cannot be used as a folder name/);
		expect(isSafeId('../etc')).toBe(false);
		expect(isSafeId('a1-b_2')).toBe(true);
	});
});
