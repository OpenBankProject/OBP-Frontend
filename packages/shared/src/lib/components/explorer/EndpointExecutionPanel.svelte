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
	 * The Explorer's right bar: compose the request, send it, read the response.
	 *
	 * The call goes through the host app's proxy rather than straight at OBP, so the
	 * user's token stays on the server and is never handed to this component.
	 */
	interface EndpointSummary {
		verb: string;
		path: string;
		operationId: string;
		exampleRequestBody?: unknown;
	}

	interface Props {
		endpoint: EndpointSummary;
		/** OBP's own base URL, shown so the composed request is the real one. */
		obpBaseUrl?: string;
		/** Where to POST/GET the call. The endpoint path is appended, minus its leading slash. */
		callBaseUrl?: string;
		tryItOutUrl?: string;
		userAuthenticated?: boolean;
	}

	let {
		endpoint,
		obpBaseUrl = '',
		callBaseUrl = '/backend/explorer/call',
		tryItOutUrl = '',
		userAuthenticated = false
	}: Props = $props();

	/** URL placeholders are the shouty segments: BANK_ID, ACCOUNT_ID, PAYMENT_SERVICE. */
	const placeholders = $derived(
		endpoint.path
			.split('/')
			.filter((segment) => /^[A-Z][A-Z0-9_]*$/.test(segment))
			.filter((segment, i, all) => all.indexOf(segment) === i)
	);

	let values = $state<Record<string, string>>({});
	let query = $state('');
	let body = $state('');
	let response = $state<{ status: number; ms: number; text: string } | null>(null);
	let sendError = $state('');
	let sending = $state(false);

	// Everything here belongs to one endpoint; clear it all when another is opened.
	$effect(() => {
		endpoint.operationId;
		values = {};
		query = '';
		body = endpoint.exampleRequestBody ? JSON.stringify(endpoint.exampleRequestBody, null, 2) : '';
		response = null;
		sendError = '';
	});

	const unfilled = $derived(placeholders.filter((p) => !values[p]?.trim()));

	const resolvedPath = $derived(
		endpoint.path
			.split('/')
			.map((segment) => (placeholders.includes(segment) ? values[segment] || segment : segment))
			.join('/')
	);

	const queryString = $derived(query.trim() ? `?${query.trim().replace(/^\?/, '')}` : '');
	const fullUrl = $derived(`${obpBaseUrl.replace(/\/$/, '')}${resolvedPath}${queryString}`);
	const sendsBody = $derived(['POST', 'PUT', 'PATCH'].includes(endpoint.verb));

	const curl = $derived.by(() => {
		const lines = [`curl -X ${endpoint.verb} '${fullUrl}'`, `  -H 'Authorization: DirectLogin token="YOUR_TOKEN"'`];
		if (sendsBody && body.trim()) {
			lines.push(`  -H 'Content-Type: application/json'`);
			lines.push(`  -d '${body.replace(/'/g, `'\\''`)}'`);
		}
		return lines.join(' \\\n');
	});

	let copied = $state(false);
	async function copyCurl() {
		try {
			await navigator.clipboard.writeText(curl);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false; // Clipboard blocked; the text is selectable either way.
		}
	}

	function prettyIfJson(text: string): string {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}

	async function send() {
		sendError = '';
		response = null;

		if (sendsBody && body.trim()) {
			try {
				JSON.parse(body);
			} catch (e) {
				sendError = `Request body is not valid JSON: ${(e as Error).message}`;
				return;
			}
		}

		sending = true;
		const startedAt = performance.now();
		try {
			const url = `${callBaseUrl.replace(/\/$/, '')}${resolvedPath}${queryString}`;
			const result = await fetch(url, {
				method: endpoint.verb,
				headers: sendsBody ? { 'Content-Type': 'application/json' } : {},
				body: sendsBody && body.trim() ? body : undefined
			});
			const text = await result.text();
			response = { status: result.status, ms: Math.round(performance.now() - startedAt), text: prettyIfJson(text) };
		} catch (e) {
			sendError = (e as Error).message || 'The request could not be sent.';
		} finally {
			sending = false;
		}
	}

	const statusClass = $derived(
		!response
			? ''
			: response.status < 300
				? 'text-emerald-700 dark:text-emerald-400'
				: response.status < 500
					? 'text-amber-700 dark:text-amber-400'
					: 'text-red-700 dark:text-red-400'
	);
</script>

<div class="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4">
	<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">Call this endpoint</h2>

	<div class="flex flex-col gap-1">
		<span class="font-mono text-xs font-semibold">{endpoint.verb}</span>
		<code class="break-all rounded bg-surface-100-800 p-2 text-xs">{fullUrl}</code>
	</div>

	{#if placeholders.length > 0}
		<fieldset class="flex shrink-0 flex-col gap-2">
			<legend class="text-xs font-semibold uppercase tracking-wide text-surface-600-400">
				URL parameters
			</legend>
			{#each placeholders as placeholder (placeholder)}
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-mono text-surface-700-300">{placeholder}</span>
					<input class="input text-xs" bind:value={values[placeholder]} placeholder={placeholder} />
				</label>
			{/each}
		</fieldset>
	{/if}

	<label class="flex flex-col gap-1 text-xs">
		<span class="font-semibold uppercase tracking-wide text-surface-600-400">Query string</span>
		<input class="input text-xs" bind:value={query} placeholder="limit=10&amp;offset=0" />
	</label>

	{#if sendsBody}
		<label class="flex shrink-0 flex-col gap-1 text-xs">
			<span class="font-semibold uppercase tracking-wide text-surface-600-400">Request body</span>
			<textarea class="textarea min-h-48 font-mono text-xs" rows="10" bind:value={body}></textarea>
		</label>
	{/if}

	<div class="flex shrink-0 flex-col gap-2">
		<button type="button" class="btn preset-filled" onclick={send} disabled={sending}>
			{sending ? 'Sending…' : `Send ${endpoint.verb}`}
		</button>
		{#if unfilled.length > 0}
			<p class="text-xs text-surface-600-400">
				Still a placeholder: <span class="font-mono">{unfilled.join(', ')}</span>
			</p>
		{/if}
		{#if !userAuthenticated}
			<p class="text-xs text-surface-600-400">
				Not signed in — the request is sent without credentials, so OBP will answer only if
				this endpoint is public. <a class="anchor" href="/login">Log in</a> to call it as you.
			</p>
		{/if}
	</div>

	{#if sendError}
		<p class="text-xs text-red-700 dark:text-red-400" role="alert">{sendError}</p>
	{/if}

	{#if response}
		<section class="flex flex-col gap-1" aria-live="polite">
			<div class="flex items-baseline justify-between">
				<span class="text-xs font-semibold uppercase tracking-wide text-surface-600-400">Response</span>
				<span class="font-mono text-xs {statusClass}">{response.status} · {response.ms} ms</span>
			</div>
			<pre class="max-h-96 max-w-full overflow-auto rounded bg-surface-100-800 p-2 text-xs"><code
					>{response.text}</code
				></pre>
		</section>
	{/if}

	<div class="flex flex-col gap-1">
		<div class="flex items-center justify-between">
			<span class="text-xs font-semibold uppercase tracking-wide text-surface-600-400">curl</span>
			<button type="button" class="btn btn-sm preset-tonal" onclick={copyCurl}>
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>
		<pre class="max-w-full whitespace-pre-wrap break-all rounded bg-surface-100-800 p-2 text-xs"><code>{curl}</code></pre>
	</div>

	{#if tryItOutUrl}
		<div class="mt-auto border-t border-surface-300-600 pt-3">
			<a class="anchor text-xs" href={tryItOutUrl} target="_blank" rel="noopener noreferrer">
				Open this endpoint in API Explorer II
			</a>
		</div>
	{/if}
</div>
