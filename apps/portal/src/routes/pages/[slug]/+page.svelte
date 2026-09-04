<script lang="ts">
	import { goto } from '$app/navigation';
	import { AppStudioPreview, appStudioPathToProxyPath } from '@obp/shared/components';
	import type { AppStudioProxyResult } from '@obp/shared/components';
	import { initLandingBehaviours, LANDING_BASE_CSS } from '@obp/shared/landing';

	let { data } = $props();

	let pageEl = $state<HTMLElement | null>(null);
	$effect(() => {
		if (data.kind !== 'page' || !pageEl) return;
		return initLandingBehaviours(pageEl);
	});

	// ---- App bridge: the sandboxed app's OBP calls go through the Portal ----
	async function handleAppRequest(req: { method: string; path: string; body?: unknown }): Promise<AppStudioProxyResult> {
		const proxyPath = appStudioPathToProxyPath(req.path, '/pages/obp');
		if (!proxyPath) return { ok: false, status: 400, error: `Path must start with /obp/ (got ${JSON.stringify(req.path)})` };
		const method = req.method.toUpperCase();
		// Reads run unattended. A write is the visitor's own action on their own data: ask first.
		if (method !== 'GET' && method !== 'HEAD') {
			if (!data.isLoggedIn) return { ok: false, status: 401, error: 'Sign in to the Portal to let this app write to your data' };
			if (!confirm(`This app wants to ${method} ${req.path}.\n\nAllow it?`)) return { ok: false, status: 403, error: 'Blocked by the visitor' };
		}
		try {
			const response = await fetch(proxyPath, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {})
			});
			const text = await response.text();
			let body: unknown = text;
			try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
			return { ok: response.ok, status: response.status, body, error: response.ok ? undefined : ((body as any)?.message ?? `HTTP ${response.status}`) };
		} catch (e) {
			return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
		}
	}

	// obp.navigate(url): only paths on this Portal are followed, never other origins.
	function handleAppNavigate(url: string) {
		if (url.startsWith('/') && !url.startsWith('//')) void goto(url);
	}
</script>

<svelte:head>
	<title>{data.title}</title>
	{#if data.summary}<meta name="description" content={data.summary} />{/if}
</svelte:head>

{#if data.kind === 'app'}
	<div class="container mx-auto max-w-7xl px-4 py-6" data-testid="published-app" data-slug={data.slug}>
		<AppStudioPreview source={data.source} layout="fill" minHeight={600} onRequest={handleAppRequest} onNavigate={handleAppNavigate} />
	</div>
{:else}
	{@html `<style>${LANDING_BASE_CSS}</style>`}
	<div bind:this={pageEl} class="container mx-auto max-w-7xl px-4 py-6" data-testid="published-page" data-slug={data.slug}>
		{@html data.html}
	</div>
{/if}
