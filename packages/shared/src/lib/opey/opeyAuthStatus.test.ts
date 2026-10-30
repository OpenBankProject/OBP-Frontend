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
/**
 * Opey session start-up: the auth route keeps Opey's status, the widget does not retry a refusal
 * or call the route for a logged-out visitor, and a consent that is still INITIATED is not
 * replaced by a new one. Lives outside src/lib/server so vitest picks it up.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOpeyAuthHandler } from '../server/opey/handlers';
import { DefaultOBPIntegrationService } from '../server/obp/OBPIntegrationService';
import { OpeySessionService } from './services/OpeySessionService';
import { SessionController } from './controllers/SessionController';
import { SessionState } from './state/SessionState';

const OPEY = 'http://opey.test';

function opeyRefuses(status: number, detail: string) {
	return vi.fn(async () => new Response(JSON.stringify({ detail }), { status }));
}

function authEvent() {
	return { request: new Request('http://app.test/backend/opey/auth', { method: 'POST' }) } as any;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('POST /backend/opey/auth keeps the status Opey answered with', () => {
	it('answers 401, not 500, to a logged-out visitor when Opey wants credentials', async () => {
		vi.stubGlobal('fetch', opeyRefuses(401, 'Missing Authorization headers'));
		const { POST } = createOpeyAuthHandler({
			opeyBaseUrl: OPEY,
			getAccessToken: () => undefined,
			getSession: () => undefined
		});
		const res = await POST(authEvent());
		expect(res.status).toBe(401);
		expect((await res.json()).message).toContain('Missing Authorization headers');
	});

	it('answers 401, not 500, when Opey says the consent is not ACCEPTED', async () => {
		vi.stubGlobal('fetch', opeyRefuses(401, 'OBP-35005: Consent-Id is not in status ACCEPTED'));
		const { POST } = createOpeyAuthHandler({
			opeyBaseUrl: OPEY,
			opeyConsumerId: 'opey-consumer',
			getAccessToken: () => 'token',
			getSession: () => ({}),
			getOrCreateOpeyConsent: async () => ({ consent_id: 'c1', jwt: 'a.b.c' }) as any
		});
		const res = await POST(authEvent());
		expect(res.status).toBe(401);
		expect((await res.json()).message).toContain('OBP-35005');
	});

	it('does not blame an expired JWT when the cause is the consent status', async () => {
		vi.stubGlobal('fetch', opeyRefuses(401, 'OBP-35005: Consent-Id is not in status ACCEPTED'));
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const { POST } = createOpeyAuthHandler({
			opeyBaseUrl: OPEY,
			opeyConsumerId: 'opey-consumer',
			getAccessToken: () => 'token',
			getSession: () => ({}),
			getOrCreateOpeyConsent: async () => ({ consent_id: 'c1', jwt: 'a.b.c' }) as any
		});
		await POST(authEvent());
		const logged = [...info.mock.calls, ...log.mock.calls].flat().join(' ');
		expect(logged).not.toContain('JWT expired');
	});
});

describe('the widget session start-up', () => {
	function controllerFor(createSession: () => Promise<{ authenticated: boolean }>) {
		const state = new SessionState();
		const service = { createSession: vi.fn(createSession) } as any;
		return { state, service, controller: new SessionController(service, state) };
	}

	it('does not call the route for a logged-out visitor', async () => {
		const { service, controller, state } = controllerFor(async () => ({ authenticated: false }));
		await controller.initWithRetry({ userAuthenticated: false, sleep: async () => {} });
		expect(service.createSession).not.toHaveBeenCalled();
		expect(state.current.isAuthenticated).toBe(false);
	});

	it('does not retry a 401 and reports the real cause', async () => {
		const { service, controller, state } = controllerFor(async () => {
			const err: any = new Error('OBP-35005: Consent-Id is not in status ACCEPTED');
			err.status = 401;
			throw err;
		});
		await controller.initWithRetry({ userAuthenticated: true, sleep: async () => {} });
		expect(service.createSession).toHaveBeenCalledTimes(1);
		expect(state.current.status).toBe('error');
		expect(state.current.error).toContain('OBP-35005');
		expect(state.current.error).not.toContain('attempts');
	});

	it('still retries a server error', async () => {
		const { service, controller } = controllerFor(async () => {
			const err: any = new Error('boom');
			err.status = 502;
			throw err;
		});
		await controller.initWithRetry({
			userAuthenticated: true,
			maxRetries: 3,
			sleep: async () => {}
		});
		expect(service.createSession).toHaveBeenCalledTimes(3);
	});

	it('OpeySessionService carries the HTTP status on the error it throws', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () => new Response(JSON.stringify({ message: 'nope', code: 401 }), { status: 401 })
			)
		);
		await expect(
			new OpeySessionService('/backend/opey/auth').createSession()
		).rejects.toMatchObject({
			status: 401,
			message: 'nope'
		});
	});
});

describe('getOrCreateOpeyConsent with a consent that is not ACCEPTED', () => {
	const session: any = { data: { oauth: { access_token: 'tok' } } };
	const jwt = 'x.eyJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ1In0.y';

	function obpWith(consents: any[], created?: any) {
		const post = vi.fn(async () => created);
		const get = vi.fn(async (path: string) => {
			if (path.endsWith('/my/consents')) return { consents };
			throw new Error('not found');
		});
		return {
			post,
			get,
			svc: new DefaultOBPIntegrationService('opey-consumer', { get, post } as any)
		};
	}

	it('does not create another consent while one is INITIATED', async () => {
		const { post, svc } = obpWith([
			{
				consent_id: 'c1',
				consumer_id: 'opey-consumer',
				status: 'INITIATED',
				jwt,
				jwt_expires_at: new Date(Date.now() + 3600_000).toISOString()
			}
		]);
		await expect(svc.getOrCreateOpeyConsent(session)).rejects.toMatchObject({ statusCode: 401 });
		expect(post).not.toHaveBeenCalled();
	});

	it('reports a freshly created consent that comes back INITIATED instead of handing it to Opey', async () => {
		const { post, svc } = obpWith([], { consent_id: 'c2', status: 'INITIATED', jwt });
		await expect(svc.getOrCreateOpeyConsent(session)).rejects.toMatchObject({ statusCode: 401 });
		expect(post).toHaveBeenCalledTimes(1);
	});

	it('still returns an ACCEPTED consent from the list without creating one', async () => {
		const { post, svc } = obpWith([
			{
				consent_id: 'c3',
				consumer_id: 'opey-consumer',
				status: 'ACCEPTED',
				jwt,
				jwt_expires_at: new Date(Date.now() + 3600_000).toISOString()
			}
		]);
		const consent = await svc.getOrCreateOpeyConsent(session);
		expect(consent.consent_id).toBe('c3');
		expect(post).not.toHaveBeenCalled();
	});
});
