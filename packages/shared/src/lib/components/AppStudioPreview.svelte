<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	/**
	 * Phone-sized preview of a generated web app, run in a sandboxed iframe.
	 *
	 * The iframe has no same-origin access; every OBP call the app makes arrives
	 * here as a postMessage and is answered through `onRequest`, which the host
	 * page implements (typically a fetch to its /proxy/obp route, with whatever
	 * gating it wants). Console output and script errors arrive through `onLog`.
	 * Bump `runId` to reload the app from `source`.
	 */
	import { onMount } from 'svelte';
	import {
		buildAppStudioSrcdoc,
		type AppStudioEmitMessage,
		type AppStudioLogMessage,
		type AppStudioNavigateMessage,
		type AppStudioProxyResult,
		type AppStudioRequestMessage,
		type AppStudioResizeMessage
	} from './appStudioShim.js';

	interface Props {
		source: string;
		runId?: number;
		/** "phone": a 390px phone frame. "fill": full width of the container, height follows the app's content. */
		layout?: 'phone' | 'fill';
		width?: number;
		height?: number;
		/** Smallest and largest frame height in "fill" layout. */
		minHeight?: number;
		maxHeight?: number;
		onRequest: (request: { method: string; path: string; body?: unknown }) => Promise<AppStudioProxyResult>;
		onLog?: (entry: { level: AppStudioLogMessage['level']; message: string }) => void;
		onReady?: () => void;
		/** The app called obp.navigate(url). The host decides whether to follow it. */
		onNavigate?: (url: string) => void;
		/** The app called obp.emit(name, data): an application-level message such as a report's result. */
		onEmit?: (name: string, data: unknown) => void;
	}

	let {
		source,
		runId = 0,
		layout = 'phone',
		width = 390,
		height = 780,
		minHeight = 480,
		maxHeight = 4000,
		onRequest,
		onLog,
		onReady,
		onNavigate,
		onEmit
	}: Props = $props();

	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let contentHeight = $state(0);
	// The frame is created only after this component has mounted and is listening. A
	// server-rendered frame starts the app before hydration, its first obp.* request is
	// posted to nobody, and the app waits forever.
	let listening = $state(false);
	const fillHeight = $derived(Math.min(maxHeight, Math.max(minHeight, contentHeight || minHeight)));

	const srcdoc = $derived.by(() => {
		// Reference runId so a bump re-renders even when the source is unchanged.
		void runId;
		return buildAppStudioSrcdoc(source);
	});

	function reply(message: object) {
		iframeEl?.contentWindow?.postMessage(message, '*');
	}

	async function handleMessage(event: MessageEvent) {
		// Only the app in our own iframe may talk to us. Its origin is opaque
		// ("null"), so identity is checked by window, not by origin.
		if (!iframeEl || event.source !== iframeEl.contentWindow) return;
		const data = event.data;
		if (!data || typeof data.type !== 'string' || !data.type.startsWith('obp-studio:')) return;

		if (data.type === 'obp-studio:ready') {
			onReady?.();
			return;
		}
		if (data.type === 'obp-studio:resize') {
			const h = Number((data as AppStudioResizeMessage).height);
			if (Number.isFinite(h) && h > 0) contentHeight = Math.round(h);
			return;
		}
		if (data.type === 'obp-studio:emit') {
			const m = data as AppStudioEmitMessage;
			onEmit?.(String(m.name ?? ''), m.data);
			return;
		}
		if (data.type === 'obp-studio:navigate') {
			onNavigate?.(String((data as AppStudioNavigateMessage).url ?? ''));
			return;
		}
		if (data.type === 'obp-studio:log') {
			const log = data as AppStudioLogMessage;
			onLog?.({ level: log.level ?? 'log', message: String(log.message ?? '') });
			return;
		}
		if (data.type === 'obp-studio:request') {
			const req = data as AppStudioRequestMessage;
			let result: AppStudioProxyResult;
			try {
				result = await onRequest({ method: req.method, path: req.path, body: req.body });
			} catch (e) {
				result = { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
			}
			reply({ type: 'obp-studio:response', id: req.id, ...result });
		}
	}

	onMount(() => {
		window.addEventListener('message', handleMessage);
		listening = true;
		return () => window.removeEventListener('message', handleMessage);
	});
</script>

{#if listening}
{#if layout === 'fill'}
	<div
		class="app-studio-fill w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700"
		style="height: {fillHeight}px;"
		data-testid="app-studio-fill"
		data-content-height={contentHeight}
	>
		{#key runId}
			<iframe
				bind:this={iframeEl}
				title="App preview"
				{srcdoc}
				sandbox="allow-scripts allow-forms allow-modals"
				referrerpolicy="no-referrer"
				class="block h-full w-full border-0 bg-white"
				data-testid="app-studio-iframe"
			></iframe>
		{/key}
	</div>
{:else}
	<div
		class="app-studio-phone mx-auto rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-xl dark:border-gray-700"
		style="width: {width + 20}px; max-width: 100%;"
		data-testid="app-studio-phone"
	>
		<div class="mx-auto mb-1 mt-2 h-1.5 w-20 rounded-full bg-gray-700"></div>
		<div class="overflow-hidden rounded-[2rem] bg-white" style="height: {height}px;">
			{#key runId}
				<iframe
					bind:this={iframeEl}
					title="App preview"
					{srcdoc}
					sandbox="allow-scripts allow-forms allow-modals"
					referrerpolicy="no-referrer"
					class="block h-full w-full border-0 bg-white"
					data-testid="app-studio-iframe"
				></iframe>
			{/key}
		</div>
	</div>
{/if}
{/if}
