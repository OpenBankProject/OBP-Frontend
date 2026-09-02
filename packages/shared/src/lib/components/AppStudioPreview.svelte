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
		type AppStudioLogMessage,
		type AppStudioProxyResult,
		type AppStudioRequestMessage
	} from './appStudioShim.js';

	interface Props {
		source: string;
		runId?: number;
		width?: number;
		height?: number;
		onRequest: (request: { method: string; path: string; body?: unknown }) => Promise<AppStudioProxyResult>;
		onLog?: (entry: { level: AppStudioLogMessage['level']; message: string }) => void;
		onReady?: () => void;
	}

	let { source, runId = 0, width = 390, height = 780, onRequest, onLog, onReady }: Props = $props();

	let iframeEl = $state<HTMLIFrameElement | null>(null);

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
		return () => window.removeEventListener('message', handleMessage);
	});
</script>

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
