<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { EndpointExecutionPanel, PaneSplitter, OpeyChat } from '@obp/shared/components';
	import type { OpeyChatOptions } from '@obp/shared/components';
	import { explorerCatalogueUrl } from '@obp/shared/explorer';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	/**
	 * Three panes, as in API Explorer II: navigation, documentation, and the call.
	 * The navigation pane is the app's sidebar — swapped in by the root layout — so what
	 * is left here is the documentation body and the right bar, which doubles as Opey's
	 * home so asking a question about an endpoint does not mean losing sight of it.
	 */
	let rightWidth = $state(32);
	// Seeded rather than left to the effect below, so the pane is server-rendered too:
	// effects do not run during SSR.
	let rightOpen = $state(untrack(() => Boolean(page.data.endpoint)));
	let rightTab = $state<'call' | 'opey'>('call');

	const endpoint = $derived(page.data.endpoint);
	const opeyEnabled = $derived(Boolean(data.opeyBaseUrl));

	// Selecting an endpoint brings the call pane out; closing it is the reader's choice.
	$effect(() => {
		if (endpoint) {
			rightOpen = true;
			rightTab = 'call';
		}
	});

	const opeyChatOptions: Partial<OpeyChatOptions> = $derived({
		baseUrl: data.opeyBaseUrl,
		displayHeader: false,
		displayConnectionPips: true
	});
</script>

<div class="flex h-full min-h-0 w-full flex-col">
	<header
		class="flex flex-wrap items-center gap-3 border-b border-surface-300-600 px-3 py-2 text-sm"
	>
		<span class="font-semibold text-surface-900-50">API Explorer</span>

		<label class="flex items-center gap-2">
			<span class="sr-only">API version</span>
			<select
				class="select select-sm w-48"
				value={data.current ? `${data.current.urlPrefix}/${data.current.shortVersion}` : ''}
				onchange={(e) => {
					const [prefix, version] = e.currentTarget.value.split('/');
					goto(explorerCatalogueUrl(prefix, version));
				}}
			>
				{#each data.versionGroups as group (group.urlPrefix)}
					<optgroup label={group.urlPrefix}>
						{#each group.versions as v (v.fullyQualifiedVersion)}
							<option value={`${v.urlPrefix}/${v.shortVersion}`}>{v.fullyQualifiedVersion}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>

		<span class="text-surface-600-400">{data.index.length} endpoints</span>

		<div class="ml-auto flex items-center gap-2">
			{#if data.obpBaseUrl}
				<a class="anchor text-xs" href={data.obpBaseUrl} target="_blank" rel="noopener noreferrer">
					{data.obpBaseUrl}
				</a>
			{/if}
			{#if opeyEnabled}
				<button
					type="button"
					class="btn btn-sm preset-tonal"
					aria-pressed={rightOpen && rightTab === 'opey'}
					onclick={() => {
						if (rightOpen && rightTab === 'opey') rightOpen = false;
						else {
							rightOpen = true;
							rightTab = 'opey';
						}
					}}
				>
					Opey
				</button>
			{/if}
		</div>
	</header>

	<div class="flex min-h-0 flex-1" data-testid="explorer-panes">
		<!-- A section, not a main: the Portal's root layout already owns the page's <main>. -->
		<section
			class="min-h-0 min-w-0 flex-1 overflow-y-auto"
			aria-label="Endpoint documentation"
			data-testid="explorer-body"
		>
			{@render children()}
		</section>

		{#if rightOpen}
			<div class="hidden lg:block">
				<PaneSplitter
					bind:value={rightWidth}
					min={20}
					max={55}
					fromEnd
					label="Resize the call pane"
				/>
			</div>

			<aside
				class="hidden min-h-0 min-w-0 shrink-0 flex-col border-l border-surface-300-600 lg:flex lg:w-[var(--right-w)]"
				style="--right-w: {rightWidth}%"
				aria-label={rightTab === 'call' ? 'Call this endpoint' : 'Opey'}
			>
				<div class="flex items-center gap-1 border-b border-surface-300-600 px-2 py-1">
					{#if endpoint}
						<button
							type="button"
							class="btn btn-sm {rightTab === 'call' ? 'preset-filled' : 'preset-tonal'}"
							aria-pressed={rightTab === 'call'}
							onclick={() => (rightTab = 'call')}
						>
							Call
						</button>
					{/if}
					{#if opeyEnabled}
						<button
							type="button"
							class="btn btn-sm {rightTab === 'opey' ? 'preset-filled' : 'preset-tonal'}"
							aria-pressed={rightTab === 'opey'}
							onclick={() => (rightTab = 'opey')}
						>
							Opey
						</button>
					{/if}
					<button
						type="button"
						class="btn btn-sm preset-tonal ml-auto"
						onclick={() => (rightOpen = false)}
					>
						Close
					</button>
				</div>

				<div class="min-h-0 min-w-0 flex-1">
					{#if rightTab === 'call' && endpoint}
						<EndpointExecutionPanel
							{endpoint}
							obpBaseUrl={data.obpBaseUrl}
							tryItOutUrl={page.data.tryItOutUrl ?? ''}
							userAuthenticated={Boolean(page.data.username)}
						/>
					{:else if rightTab === 'opey' && opeyEnabled}
						<div class="flex h-full min-h-0 flex-col p-2">
							<OpeyChat {opeyChatOptions} userAuthenticated={Boolean(page.data.username)} />
						</div>
					{/if}
				</div>
			</aside>
		{/if}
	</div>
</div>
