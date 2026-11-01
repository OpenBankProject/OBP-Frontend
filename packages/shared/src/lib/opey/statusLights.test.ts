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
import { connectionLight, downComponents, servicesHint, servicesLight, sessionLight } from './statusLights';

describe('status lights', () => {
	it('shows a connection green only when healthy', () => {
		expect(connectionLight('healthy')).toBe('green');
		expect(connectionLight('unknown')).toBe('amber');
		expect(connectionLight('degraded')).toBe('red');
		expect(connectionLight('unhealthy')).toBe('red');
	});

	it("shows Opey's services green only when every component is up", () => {
		const up = { up: true };
		expect(servicesLight(null)).toBe('amber');
		expect(servicesLight({ overall: 'ok', components: { obp: up, mcp: up, llm: up } })).toBe('green');
		const degraded = { overall: 'degraded', components: { obp: up, mcp: { up: false }, llm: up } };
		expect(servicesLight(degraded)).toBe('red');
		expect(downComponents(degraded)).toEqual(['mcp']);
		const badKey = { overall: 'degraded', components: { obp: up, llm: { up: false, detail: 'the API key is a placeholder' } } };
		expect(servicesHint(badKey)).toBe('Part of Opey is not working: its AI model (the API key is a placeholder).');
	});

	it('shows the session green only when it is what the User should have', () => {
		expect(sessionLight({ status: 'loading', isAuthenticated: false, userAuthenticated: true })).toBe('amber');
		expect(sessionLight({ status: 'error', isAuthenticated: false, userAuthenticated: true })).toBe('red');
		expect(sessionLight({ status: 'ready', isAuthenticated: true, userAuthenticated: true })).toBe('green');
		expect(sessionLight({ status: 'ready', isAuthenticated: false, userAuthenticated: true })).toBe('red');
		expect(sessionLight({ status: 'ready', isAuthenticated: false, userAuthenticated: false })).toBe('green');
	});
});
