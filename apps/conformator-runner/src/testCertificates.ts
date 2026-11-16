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
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * For tests only: a CA, a server certificate for localhost and 127.0.0.1, and a client certificate, made with openssl
 * in a new temporary folder. Returns the folder and the PEM texts.
 */
export function makeTestCertificates() {
	const dir = mkdtempSync(join(tmpdir(), 'runner-certs-'));
	const f = (name: string) => join(dir, name);
	const ssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'pipe' });
	ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('ca.key'), '-out', f('ca.crt'), '-days', '1', '-subj', '/CN=Test CA');
	writeFileSync(f('san.cnf'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\n');
	for (const [name, cn] of [['server', 'localhost'], ['client', 'runner']]) {
		ssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', f(`${name}.key`), '-out', f(`${name}.csr`), '-subj', `/CN=${cn}`);
		ssl('x509', '-req', '-in', f(`${name}.csr`), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial', '-out', f(`${name}.crt`), '-days', '1', ...(name === 'server' ? ['-extfile', f('san.cnf')] : []));
	}
	const read = (name: string) => readFileSync(f(name), 'utf8');
	return { dir, ca: read('ca.crt'), serverCert: read('server.crt'), serverKey: read('server.key'), clientCert: read('client.crt'), clientKey: read('client.key') };
}
