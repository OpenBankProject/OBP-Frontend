<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { RefreshCw } from '@lucide/svelte';
	import {
		getSelectedConsentViews,
		setSelectedConsentViews,
		clearSelectedConsentViews,
		type ConsentViewSelection
	} from '$shared/opey/utils/consentScope';

	interface AccountView {
		view_id: string;
		short_name?: string;
		description?: string;
		is_public?: boolean;
	}

	interface Account {
		account_id: string;
		bank_id: string;
		label?: string;
		views?: AccountView[];
	}

	/** Minimal shape of a `currentBank` store — used to scope accounts to the selected bank. */
	interface BankStoreLike {
		bankId: string;
	}

	interface Props {
		bankStore: BankStoreLike;
	}

	let { bankStore }: Props = $props();

	let accounts = $state<Account[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let open = $state(false);
	let selected = $state<ConsentViewSelection[]>([]);
	// Top-level element ref (either branch of {#if open} binds to it) so external
	// triggers — e.g. a consent prompt that needs view scope — can scroll the
	// picker into view and force it open.
	let wrapperEl = $state<HTMLElement | null>(null);

	function selectionKey(bankId: string, accountId: string, viewId: string): string {
		return `${bankId}::${accountId}::${viewId}`;
	}

	let selectedSet = $derived(
		new Set(selected.map((v) => selectionKey(v.bank_id, v.account_id, v.view_id)))
	);

	// Scope the list to the bank chosen in the bank picker. With no bank selected, show all.
	let filteredAccounts = $derived(
		bankStore.bankId ? accounts.filter((a) => a.bank_id === bankStore.bankId) : accounts
	);

	function isViewSelected(bankId: string, accountId: string, viewId: string): boolean {
		return selectedSet.has(selectionKey(bankId, accountId, viewId));
	}

	function toggleView(bankId: string, accountId: string, viewId: string) {
		const key = selectionKey(bankId, accountId, viewId);
		if (selectedSet.has(key)) {
			selected = selected.filter(
				(v) => !(v.bank_id === bankId && v.account_id === accountId && v.view_id === viewId)
			);
		} else {
			selected = [...selected, { bank_id: bankId, account_id: accountId, view_id: viewId }];
		}
		setSelectedConsentViews(selected);
	}

	function clearAll() {
		selected = [];
		clearSelectedConsentViews();
	}

	async function fetchAccounts() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch('/proxy/obp/v7.0.0/my/accounts');
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.message || `HTTP ${response.status}`);
			}
			const data = await response.json();
			accounts = (data.accounts || data) as Account[];
			if (!Array.isArray(accounts)) accounts = [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load accounts';
		} finally {
			isLoading = false;
		}
	}

	function syncFromStorage() {
		selected = getSelectedConsentViews();
	}

	// Open the picker and scroll it into view in response to a global request
	// (fired by the ConsentRequestCard when a view-scoped consent has no scope yet).
	async function focusFromExternal() {
		open = true;
		await tick();
		wrapperEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	onMount(() => {
		syncFromStorage();
		fetchAccounts();
		window.addEventListener('obp:consent-scope-changed', syncFromStorage);
		window.addEventListener('obp:open-account-scope-picker', focusFromExternal);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('obp:consent-scope-changed', syncFromStorage);
			window.removeEventListener('obp:open-account-scope-picker', focusFromExternal);
		}
	});

	let summary = $derived(selected.length === 0 ? 'none selected' : `${selected.length} selected`);
</script>

{#if open}
	<div
		bind:this={wrapperEl}
		class="inline-block rounded-md border border-surface-300-700 bg-surface-100-900 p-3 text-left min-w-[18rem] max-w-md"
		data-testid="account-scope-picker-open"
	>
		<div class="mb-2 flex items-center justify-between gap-2">
			<span class="text-sm font-medium">Working accounts</span>
			<button
				type="button"
				class="text-sm opacity-60 hover:opacity-100"
				onclick={() => (open = false)}
				title="Close"
			>&times;</button>
		</div>

		<p class="mb-2 text-xs opacity-70">
			Pick the accounts and views Opey should use. Selected views are attached to any consent
			granted from this chat.
		</p>

		<div class="mb-2 flex items-center gap-2">
			<button
				type="button"
				class="rounded-md border border-surface-300-700 px-2 py-0.5 text-xs hover:bg-surface-200-800"
				onclick={fetchAccounts}
				disabled={isLoading}
				data-testid="account-scope-refresh"
			>
				<RefreshCw size={12} class={isLoading ? 'inline animate-spin' : 'inline'} />
				Refresh
			</button>
			{#if selected.length > 0}
				<button
					type="button"
					class="rounded-md border border-surface-300-700 px-2 py-0.5 text-xs hover:bg-surface-200-800"
					onclick={clearAll}
					data-testid="account-scope-clear"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if error}
			<div class="mb-2 rounded bg-error-100-900 px-2 py-1 text-xs text-error-700-300">
				{error}
			</div>
		{/if}

		{#if isLoading && accounts.length === 0}
			<p class="text-xs opacity-70">Loading accounts…</p>
		{:else if filteredAccounts.length === 0}
			<p class="text-xs opacity-70">
				{bankStore.bankId ? 'No accounts at the selected bank.' : 'No accounts found.'}
			</p>
		{:else}
			<div class="max-h-64 space-y-2 overflow-y-auto">
				{#each filteredAccounts as account (account.bank_id + '::' + account.account_id)}
					{@const views = account.views || []}
					<div
						class="rounded-md border border-surface-200-800 p-2"
						data-testid="account-scope-account"
					>
						<div class="mb-1 flex items-baseline justify-between gap-2">
							<span class="text-sm font-medium">{account.label || account.account_id}</span>
							<span class="font-mono text-[11px] opacity-60">{account.bank_id}</span>
						</div>
						{#if views.length === 0}
							<p class="text-[11px] italic opacity-60">No views available</p>
						{:else}
							<div class="flex flex-wrap gap-1">
								{#each views as view (view.view_id)}
									{@const checked = isViewSelected(account.bank_id, account.account_id, view.view_id)}
									<label
										class="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]
											{checked
												? 'border-tertiary-500 bg-tertiary-100-900'
												: 'border-surface-300-700 hover:bg-surface-200-800'}"
									>
										<input
											type="checkbox"
											class="h-3 w-3"
											{checked}
											onchange={() => toggleView(account.bank_id, account.account_id, view.view_id)}
											data-testid="account-scope-view-{account.account_id}-{view.view_id}"
										/>
										<span>{view.short_name || view.view_id}</span>
									</label>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<span bind:this={wrapperEl} class="text-sm" data-testid="account-scope-picker">
		Working accounts: {summary}
		<button
			type="button"
			class="hover:text-tertiary-400"
			onclick={() => (open = true)}
			title="Choose working accounts"
			aria-label="Choose working accounts"
		>&#9998;</button>
	</span>
{/if}
