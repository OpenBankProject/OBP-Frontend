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
