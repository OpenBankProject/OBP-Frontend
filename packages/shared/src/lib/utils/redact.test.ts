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
import { redactUrlEncodedBody, redactForLog } from './redact';

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

describe('redactForLog', () => {
	it('redacts passwords, secrets and tokens, keeping other fields', () => {
		const body = { username: 'someone', password: 'pw', new_password: 'pw2', consumer_secret: 's', access_token: 't', email: 'a@example.com' };
		expect(redactForLog(body)).toEqual({
			username: 'someone',
			password: '[redacted]',
			new_password: '[redacted]',
			consumer_secret: '[redacted]',
			access_token: '[redacted]',
			email: 'a@example.com'
		});
	});

	it('redacts at any depth, including inside arrays', () => {
		const body = { user: { password: 'pw' }, items: [{ client_secret: 's', name: 'n' }] };
		expect(redactForLog(body)).toEqual({ user: { password: '[redacted]' }, items: [{ client_secret: '[redacted]', name: 'n' }] });
	});

	it('redacts Consumer keys and client ids', () => {
		expect(redactForLog({ consumer_key: 'k', client_id: 'c', consumer_id: 'id' })).toEqual({ consumer_key: '[redacted]', client_id: '[redacted]', consumer_id: 'id' });
	});

	it('redacts one-time codes and challenge answers', () => {
		expect(redactForLog({ otp: '123456', pin: '0000', answer: '42' })).toEqual({ otp: '[redacted]', pin: '[redacted]', answer: '[redacted]' });
	});

	it('passes non-objects through and does not change the input', () => {
		expect(redactForLog('text')).toBe('text');
		expect(redactForLog(undefined)).toBeUndefined();
		const body = { password: 'keep-me' };
		redactForLog(body);
		expect(body.password).toBe('keep-me');
	});
});
