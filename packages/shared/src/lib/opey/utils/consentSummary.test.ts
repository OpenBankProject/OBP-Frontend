import { describe, it, expect } from 'vitest';
import {
	summariseConsentJwt,
	addGrantedConsent,
	activeConsents,
	consentsCover,
	type GrantedConsentSummary
} from './consentSummary';

function fakeJwt(payload: Record<string, unknown>): string {
	const b64 = (s: string) => Buffer.from(s).toString('base64url');
	return `${b64('{"alg":"none"}')}.${b64(JSON.stringify(payload))}.sig`;
}

const NOW = 1_700_000_000_000;

describe('summariseConsentJwt', () => {
	it('extracts entitlements, views, id and expiry', () => {
		const jwt = fakeJwt({
			jti: 'consent-1',
			exp: NOW / 1000 + 3600,
			entitlements: [{ role_name: 'CanCreateBank', bank_id: '' }, { role_name: 'CanGetBank', bank_id: 'b1' }],
			views: [{ bank_id: 'b1', account_id: 'a1', view_id: 'owner' }]
		});
		const s = summariseConsentJwt(jwt, NOW);
		expect(s).not.toBeNull();
		expect(s!.id).toBe('consent-1');
		expect(s!.entitlements).toEqual([
			{ role_name: 'CanCreateBank', bank_id: '' },
			{ role_name: 'CanGetBank', bank_id: 'b1' }
		]);
		expect(s!.views).toEqual([{ bank_id: 'b1', account_id: 'a1', view_id: 'owner' }]);
		expect(s!.expiresAt).toBe(NOW + 3_600_000);
		expect(s!.grantedAt).toBe(NOW);
	});

	it('tolerates missing arrays and falls back to the JWT as id', () => {
		const jwt = fakeJwt({ sub: 'x' });
		const s = summariseConsentJwt(jwt, NOW);
		expect(s).toEqual({ id: jwt, entitlements: [], views: [], expiresAt: null, grantedAt: NOW });
	});

	it('returns null for garbage', () => {
		expect(summariseConsentJwt('not-a-jwt', NOW)).toBeNull();
		expect(summariseConsentJwt('a.!!!.c', NOW)).toBeNull();
	});
});

describe('addGrantedConsent / activeConsents / consentsCover', () => {
	const c = (id: string, exp: number | null, ents: GrantedConsentSummary['entitlements']): GrantedConsentSummary => ({
		id,
		entitlements: ents,
		views: [],
		expiresAt: exp,
		grantedAt: NOW
	});

	it('dedupes by id, keeping the latest record last', () => {
		const a = c('x', null, []);
		const b = c('x', NOW + 1, []);
		expect(addGrantedConsent([a, c('y', null, [])], b).map((s) => s.id)).toEqual(['y', 'x']);
	});

	it('drops expired consents but keeps unknown expiry', () => {
		const list = [c('old', NOW - 1, []), c('live', NOW + 1, []), c('unknown', null, [])];
		expect(activeConsents(list, NOW).map((s) => s.id)).toEqual(['live', 'unknown']);
	});

	it('covers by exact bank or by system-wide entitlement', () => {
		const list = [c('a', null, [{ role_name: 'CanGetBank', bank_id: 'b1' }, { role_name: 'CanCreateBank', bank_id: '' }])];
		expect(consentsCover(list, { role_name: 'CanGetBank', bank_id: 'b1' })).toBe(true);
		expect(consentsCover(list, { role_name: 'CanGetBank', bank_id: 'b2' })).toBe(false);
		expect(consentsCover(list, { role_name: 'CanCreateBank', bank_id: 'anything' })).toBe(true);
		expect(consentsCover(list, { role_name: 'CanCreateAccount', bank_id: 'b1' })).toBe(false);
	});
});

describe('setConsentReferenceId', () => {
	it('attaches the reference id only to the matching consent', async () => {
		const { setConsentReferenceId } = await import('./consentSummary');
		const base = { entitlements: [], views: [], expiresAt: null, grantedAt: NOW };
		const out = setConsentReferenceId([{ id: 'a', ...base }, { id: 'b', ...base }], 'b', 'ref-b');
		expect(out.map((c) => c.referenceId)).toEqual([undefined, 'ref-b']);
	});
});
