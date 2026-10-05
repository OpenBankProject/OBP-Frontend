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

// These tests cover how the API Metrics page explains an empty list. When no metrics come back
// and the user has CanGetConfig, the server load reads check_api_metrics from Deployment Checks
// so the page can say whether this OBP-API instance records metrics at all.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/oauth/sessionHelper', () => ({
	SessionOAuthHelper: { getSessionOAuth: vi.fn(() => ({ accessToken: 'token-1' })) }
}));
vi.mock('$lib/obp/requests', () => ({
	obp_requests: { get: vi.fn(), getResponse: vi.fn() }
}));
vi.mock('@obp/shared/health-check', () => ({
	healthCheckRegistry: { getSnapshot: vi.fn(() => undefined) }
}));

import { load } from '$lib/../routes/(protected)/metrics/+page.server';
import { obp_requests } from '$lib/obp/requests';

const getResponse = vi.mocked(obp_requests.getResponse);
const get = vi.mocked(obp_requests.get);

const deploymentEndpoint = '/obp/v7.0.0/management/system/diagnostics/deployment';

const writeMetricsOff = {
	id: 'check_api_metrics',
	status: 'INFO',
	message: 'API Metrics are not recorded on this instance (write_metrics is false).',
	evidence: [
		{ name: 'write_metrics', value: 'false' },
		{ name: 'records lost since start-up', value: '0' }
	]
};

function respondWithMetrics(metrics: unknown[]) {
	getResponse.mockResolvedValue({ json: async () => ({ metrics }) } as Response);
}

function runLoad(roles: string[]) {
	return load({
		locals: {
			session: {
				data: { user: { entitlements: { list: roles.map((role_name) => ({ role_name })) } } }
			}
		},
		url: new URL('http://localhost/metrics'),
		depends: () => {}
	} as any) as Promise<any>;
}

describe('API Metrics page: why the list is empty', () => {
	beforeEach(() => {
		getResponse.mockReset();
		get.mockReset();
	});

	it('reads check_api_metrics when the list is empty and the user has CanGetConfig', async () => {
		respondWithMetrics([]);
		get.mockResolvedValue({ checks: [{ id: 'check_redis', status: 'OK' }, writeMetricsOff] });

		const result = await runLoad(['CanReadMetrics', 'CanGetConfig']);

		expect(get).toHaveBeenCalledWith(deploymentEndpoint, 'token-1');
		expect(result.metricsRecordingCheck).toEqual({
			status: 'INFO',
			message: writeMetricsOff.message,
			evidence: writeMetricsOff.evidence
		});
	});

	it('does not ask Deployment Checks without CanGetConfig', async () => {
		respondWithMetrics([]);

		const result = await runLoad(['CanReadMetrics']);

		expect(get).not.toHaveBeenCalled();
		expect(result.metricsRecordingCheck).toBeNull();
	});

	it('does not ask Deployment Checks when metrics came back', async () => {
		respondWithMetrics([{ url: '/obp/v6.0.0/banks' }]);

		const result = await runLoad(['CanReadMetrics', 'CanGetConfig']);

		expect(get).not.toHaveBeenCalled();
		expect(result.metricsRecordingCheck).toBeNull();
	});

	it('still loads the page when Deployment Checks cannot be read', async () => {
		respondWithMetrics([]);
		get.mockRejectedValue(new Error('403'));

		const result = await runLoad(['CanReadMetrics', 'CanGetConfig']);

		expect(result.hasApiAccess).toBe(true);
		expect(result.metricsRecordingCheck).toBeNull();
	});
});
