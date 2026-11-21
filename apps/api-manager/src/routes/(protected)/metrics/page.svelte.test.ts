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

// The metrics page picks its transport on first load. When gRPC is the default it must open the stream
// without calling replaceState, which SvelteKit can't run before its router has started.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { readable } from 'svelte/store';

const navigation = vi.hoisted(() => ({ goto: vi.fn(), replaceState: vi.fn(), invalidate: vi.fn() }));
vi.mock('$app/navigation', () => navigation);
vi.mock('$app/stores', () => ({
	page: readable({ data: { externalLinks: {} }, url: new URL('http://localhost/metrics') })
}));
vi.mock('$lib/utils/toastService', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/config', () => ({
	configHelpers: { getObpConnectionInfo: () => ({ host: 'obp.test', port: 443, displayName: 'obp.test:443' }) }
}));

import Page from './+page.svelte';

const streams: string[] = [];
class FakeEventSource {
	onopen: (() => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(url: string) {
		streams.push(url);
	}
	addEventListener() {}
	close() {}
}

function pageData(overrides: Record<string, unknown> = {}) {
	return {
		metrics: { metrics: [] },
		lastUpdated: new Date().toISOString(),
		hasApiAccess: true,
		error: null,
		externalLinks: {},
		metricsRecordingCheck: null,
		grpcAvailable: true,
		...overrides
	};
}

describe('metrics page transport on first load', () => {
	beforeEach(() => {
		streams.length = 0;
		vi.stubGlobal('EventSource', FakeEventSource);
		window.history.replaceState({}, '', '/metrics');
	});

	it('opens the gRPC stream without replaceState when gRPC is available', async () => {
		render(Page, { props: { data: pageData() } });
		await vi.waitFor(() => expect(streams).toHaveLength(1));
		expect(streams[0]).toMatch(/^\/backend\/metrics\/stream\?/);
		expect(navigation.replaceState).not.toHaveBeenCalled();
		expect(navigation.goto).toHaveBeenCalledWith(expect.stringContaining('transport=grpc'), expect.anything());
	});

	it('honours ?transport=grpc without replaceState', async () => {
		window.history.replaceState({}, '', '/metrics?transport=grpc');
		render(Page, { props: { data: pageData({ grpcAvailable: false }) } });
		await vi.waitFor(() => expect(streams).toHaveLength(1));
		expect(navigation.replaceState).not.toHaveBeenCalled();
	});

	it('stays on REST without a stream when gRPC is not available', async () => {
		render(Page, { props: { data: pageData({ grpcAvailable: false }) } });
		await vi.waitFor(() => expect(navigation.goto).toHaveBeenCalled());
		expect(navigation.goto).toHaveBeenCalledWith(expect.stringContaining('transport=rest'), expect.anything());
		expect(streams).toHaveLength(0);
	});

	it('keeps the choice in the URL when the user switches transport', async () => {
		const { getByTestId } = render(Page, { props: { data: pageData() } });
		await vi.waitFor(() => expect(streams).toHaveLength(1));
		await fireEvent.click(getByTestId('transport-rest'));
		expect(navigation.replaceState).toHaveBeenCalledTimes(1);
		expect(String(navigation.replaceState.mock.calls[0][0])).toContain('transport=rest');
	});
});
