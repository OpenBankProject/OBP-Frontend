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
import { describe, expect, it } from 'vitest';
import { evaluateConsentConfig, evaluateMcpMode, evaluateOpeyModel, evaluateOpeyObp } from './stackChecks';

describe('Opey stack checks', () => {
	it("reports Opey's AI model with Opey's reason", () => {
		expect(evaluateOpeyModel({ components: { llm: { up: true, provider: 'anthropic' } } }).status).toBe('healthy');
		const down = evaluateOpeyModel({ components: { llm: { up: false, detail: 'the API key is a placeholder' } } });
		expect(down.status).toBe('unhealthy');
		expect(down.error).toContain('placeholder');
		expect(evaluateOpeyModel({}).status).toBe('unknown');
	});

	it('wants Opey on the same OBP-API as this app', () => {
		const check = evaluateOpeyObp('http://localhost:8080');
		expect(check({ components: { obp: { up: true, base_url: 'http://127.0.0.1:8080/' } } }).status).toBe('healthy');
		const elsewhere = check({ components: { obp: { up: true, base_url: 'https://apisandbox.openbankproject.com' } } });
		expect(elsewhere.status).toBe('unhealthy');
		expect(elsewhere.error).toContain('apisandbox');
		expect(check({ components: { obp: { up: false } } }).status).toBe('unhealthy');
		expect(check({ components: { obp: { up: true } } }).status).toBe('unknown');
	});

	it('needs consents allowed in OBP-API', () => {
		expect(evaluateConsentConfig({ consents_allowed: true, sca_enabled: true }).status).toBe('healthy');
		expect(evaluateConsentConfig({ consents_allowed: false }).status).toBe('unhealthy');
		expect(evaluateConsentConfig({}).status).toBe('unknown');
	});

	it('wants each OBP-MCP copy in its own mode', () => {
		const forOpey = evaluateMcpMode('consent');
		expect(forOpey({ auth: { mode: 'consent', issuers: [{ reachable: true }] } }).status).toBe('healthy');
		expect(forOpey({ auth: { mode: 'oauth' } }).error).toContain('used in consent mode');
		expect(forOpey({ auth: { mode: 'consent', issuers: [{ reachable: false, issuer_url: 'http://x' }] } }).status).toBe('unhealthy');
		expect(evaluateMcpMode('oauth')({ auth: { outbound_auth_via: 'oauth' } }).status).toBe('healthy');
	});
});
