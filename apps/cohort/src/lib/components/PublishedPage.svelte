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
	import { goto } from '$app/navigation';
	import { AppStudioPreview, appStudioPathToProxyPath } from '@obp/shared/components';
	import type { AppStudioProxyResult } from '@obp/shared/components';
	import { initLandingBehaviours, LANDING_BASE_CSS } from '@obp/shared/landing';
	import { t, type Locale } from '$lib/i18n';

	/** A page published to Cohort with App Studio: a sanitised page inline, or an App in a sandboxed frame. */
	let { page, locale }: { page: { slug: string; kind: 'page' | 'app'; html: string; source: string; isLoggedIn: boolean }; locale: Locale } = $props();

	let pageEl = $state<HTMLElement | null>(null);
	$effect(() => {
		if (page.kind !== 'page' || !pageEl) return;
		return initLandingBehaviours(pageEl);
	});

	// An App's OBP calls go through Cohort's /pages/obp proxy; reads run unattended, a write asks the visitor first.
	async function handleAppRequest(req: { method: string; path: string; body?: unknown }): Promise<AppStudioProxyResult> {
		const proxyPath = appStudioPathToProxyPath(req.path, '/pages/obp');
		if (!proxyPath) return { ok: false, status: 400, error: `Path must start with /obp/ (got ${JSON.stringify(req.path)})` };
		const method = req.method.toUpperCase();
		if (method !== 'GET' && method !== 'HEAD') {
			if (!page.isLoggedIn) return { ok: false, status: 401, error: t(locale, 'page_app_sign_in') };
			if (!confirm(`${t(locale, 'page_app_confirm')}\n\n${method} ${req.path}`)) return { ok: false, status: 403, error: 'Blocked by the visitor' };
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
			try {
				body = text ? JSON.parse(text) : null;
			} catch {
				/* keep text */
			}
			return { ok: response.ok, status: response.status, body, error: response.ok ? undefined : ((body as { message?: string })?.message ?? `HTTP ${response.status}`) };
		} catch (e) {
			return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
		}
	}

	// obp.navigate(url): only paths on this site are followed, never other origins.
	function handleAppNavigate(url: string) {
		if (url.startsWith('/') && !url.startsWith('//')) void goto(url);
	}
</script>

{#if page.kind === 'app'}
	<div data-testid="published-app" data-slug={page.slug}>
		<AppStudioPreview source={page.source} layout="fill" minHeight={600} onRequest={handleAppRequest} onNavigate={handleAppNavigate} />
	</div>
{:else}
	{@html `<style>${LANDING_BASE_CSS}</style>`}
	<div bind:this={pageEl} data-testid="published-page" data-slug={page.slug}>
		{@html page.html}
	</div>
{/if}
