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
import { describe, it, expect } from 'vitest';
import { redactUrlEncodedBody } from './redact';

function parse(query: string): Record<string, string> {
	return Object.fromEntries(new URLSearchParams(query));
}

describe('redactUrlEncodedBody', () => {
	const secretFields = ['refresh_token', 'code', 'client_secret', 'password', 'access_token', 'id_token'];

	for (const field of secretFields) {
		it(`redacts the ${field} field`, () => {
			const body = new URLSearchParams({ [field]: 'super-secret-value' });
			expect(parse(redactUrlEncodedBody(body))[field]).toBe('[redacted]');
		});
	}

	it('passes non-secret fields through verbatim', () => {
		const body = new URLSearchParams({ grant_type: 'authorization_code', scope: 'openid profile' });
		const result = parse(redactUrlEncodedBody(body));
		expect(result.grant_type).toBe('authorization_code');
		expect(result.scope).toBe('openid profile');
	});

	it('leaves a body with no secret fields unchanged', () => {
		const body = new URLSearchParams({ grant_type: 'refresh', scope: 'openid' });
		expect(redactUrlEncodedBody(body)).toBe('grant_type=refresh&scope=openid');
	});

	it('redacts secrets while preserving non-secret fields alongside them', () => {
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code: 'auth-code-123',
			client_secret: 'shhh',
			scope: 'openid'
		});
		const result = parse(redactUrlEncodedBody(body));
		expect(result).toEqual({
			grant_type: 'authorization_code',
			code: '[redacted]',
			client_secret: '[redacted]',
			scope: 'openid'
		});
	});

	it('does not mutate the input URLSearchParams', () => {
		const body = new URLSearchParams({ refresh_token: 'keep-me', grant_type: 'refresh_token' });
		redactUrlEncodedBody(body);
		expect(body.get('refresh_token')).toBe('keep-me');
	});

	it('does not add absent secret fields to the output', () => {
		const body = new URLSearchParams({ grant_type: 'authorization_code' });
		const result = parse(redactUrlEncodedBody(body));
		expect(Object.keys(result)).toEqual(['grant_type']);
	});
});
