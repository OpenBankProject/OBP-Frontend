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
import { evaluateOpeyToolsStatus } from './OpeyToolsHealthCheckService';

describe('evaluateOpeyToolsStatus', () => {
	it('reports unknown for old Opey builds that only return {status: "ok"}', () => {
		const result = evaluateOpeyToolsStatus({ status: 'ok' });
		expect(result.status).toBe('unknown');
		expect(result.error).toBeUndefined();
		expect(result.details.tool_status).toMatch(/not reported/);
	});

	it('reports healthy when Opey says its mcp component is up', () => {
		const result = evaluateOpeyToolsStatus({
			overall: 'ok',
			version: '0.2.0',
			components: { mcp: { up: true, tool_count: 12, test_call: 'ok' } }
		});
		expect(result.status).toBe('healthy');
		expect(result.error).toBeUndefined();
		expect(result.details).toMatchObject({
			tool_count: 12,
			test_call: 'ok',
			opey_version: '0.2.0',
			opey_overall: 'ok'
		});
	});

	it('stays healthy when the unauthenticated test call fails but mcp is up', () => {
		// Inbound-auth OBP-MCP servers reject the unauthenticated probe call even
		// though per-request authenticated tool loading works — mirrors Opey's
		// own non-demoting semantics.
		const result = evaluateOpeyToolsStatus({
			components: { mcp: { up: true, tool_count: 0, test_call: 'failed' } }
		});
		expect(result.status).toBe('healthy');
		expect(result.details.test_call).toBe('failed');
	});

	it('reports unhealthy with the detail when Opey says mcp is down', () => {
		const result = evaluateOpeyToolsStatus({
			overall: 'degraded',
			components: { mcp: { up: false, tool_count: 0, detail: 'no MCP servers configured' } }
		});
		expect(result.status).toBe('unhealthy');
		expect(result.error).toContain('no MCP servers configured');
		expect(result.details.detail).toBe('no MCP servers configured');
	});

	it('reports unhealthy with a generic error when mcp is down without detail', () => {
		const result = evaluateOpeyToolsStatus({
			components: { mcp: { up: false, tool_count: 0 } }
		});
		expect(result.status).toBe('unhealthy');
		expect(result.error).toMatch(/MCP tools down/);
	});

	it('treats a missing up flag as down, not up', () => {
		const result = evaluateOpeyToolsStatus({
			components: { mcp: { tool_count: 5 } }
		});
		expect(result.status).toBe('unhealthy');
	});
});
