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
	import { onMount } from 'svelte';
	import { currentBank } from '$lib/stores/currentBank.svelte';
	import type { OBPBank } from '$lib/obp/types';

	let { data } = $props();

	let bankSearch = $state<string>('');
	let synced = $state(false);

	const bankOptions = $derived.by(() => {
		const ids = new Set<string>();
		for (const a of data.accounts) ids.add(a.bank_id);
		return Array.from(ids)
			.map((id) => ({ id, label: data.banks[id]?.full_name ?? id }))
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	const filteredAccounts = $derived.by(() => {
		const q = bankSearch.trim().toLowerCase();
		if (!q) return data.accounts;
		return data.accounts.filter((a) => {
			const name = (data.banks[a.bank_id]?.full_name ?? a.bank_id).toLowerCase();
			const id = a.bank_id.toLowerCase();
			const combined = `${name} (${id})`;
			return combined.includes(q) || name.includes(q) || id.includes(q);
		});
	});

	type AccessTier = 'owner' | 'private' | 'public';

	function accessTier(views: { id: string; is_public: boolean }[]): AccessTier {
		if (views.some((v) => v.id === 'owner')) return 'owner';
		if (views.some((v) => !v.is_public)) return 'private';
		return 'public';
	}

	const tierStyle: Record<AccessTier, { header: string; row: string; label: string }> = {
		owner: {
			header: 'bg-success-500/40 text-success-700-300',
			row: 'bg-success-500/10',
			label: 'text-success-700-300'
		},
		private: {
			header: 'bg-tertiary-500/40 text-tertiary-700-300',
			row: 'bg-tertiary-500/10',
			label: 'text-tertiary-700-300'
		},
		public: {
			header: 'bg-warning-500/40 text-warning-700-300',
			row: 'bg-warning-500/10',
			label: 'text-warning-700-300'
		}
	};

	const tieredAccounts = $derived.by(() => {
		const buckets: Record<AccessTier, typeof filteredAccounts> = {
			owner: [],
			private: [],
			public: []
		};
		for (const a of filteredAccounts) {
			buckets[accessTier(a.views)].push(a);
		}
		return [
			{
				key: 'owner' as AccessTier,
				label: 'Owner access',
				hint: 'Full account access via the owner view.',
				accounts: buckets.owner
			},
			{
				key: 'private' as AccessTier,
				label: 'Other views',
				hint: 'Restricted views — not the account owner.',
				accounts: buckets.private
			},
			{
				key: 'public' as AccessTier,
				label: 'Public views only',
				hint: 'Read-only public views — limited visibility.',
				accounts: buckets.public
			}
		];
	});

	function bankName(bank_id: string): string {
		return data.banks[bank_id]?.full_name ?? bank_id;
	}

	function defaultViewId(views: { id: string; is_public: boolean }[]): string {
		if (!views || views.length === 0) return '';
		const owner = views.find((v) => v.id === 'owner');
		if (owner) return owner.id;
		const privateView = views.find((v) => !v.is_public);
		if (privateView) return privateView.id;
		return views[0].id;
	}

	function accountHref(bank_id: string, account_id: string, views: { id: string; is_public: boolean }[]): string {
		const view = defaultViewId(views);
		const base = `/user/accounts/${encodeURIComponent(bank_id)}/${encodeURIComponent(account_id)}`;
		return view ? `${base}/${encodeURIComponent(view)}` : base;
	}

	onMount(() => {
		const stored = currentBank.bank;
		if (stored) {
			const opt = bankOptions.find((o) => o.id === stored.bank_id);
			if (opt) bankSearch = `${opt.label} (${opt.id})`;
		}
		synced = true;
	});

	$effect(() => {
		if (!synced) return;
		const q = bankSearch.trim();
		if (!q) {
			if (currentBank.bank) currentBank.select(null);
			return;
		}
		const opt = bankOptions.find(
			(o) => `${o.label} (${o.id})` === q || o.label === q || o.id === q
		);
		if (opt && currentBank.bank?.bank_id !== opt.id) {
			currentBank.select({ bank_id: opt.id, full_name: opt.label } as OBPBank);
		}
	});
</script>

<div class="mx-auto max-w-7xl py-2">
<p class="mb-4 text-surface-700-300">
	Accounts you have access to across all banks. Click one for balance, transactions, and access settings.
</p>

{#if data.fetchError}
	<div class="alert variant-filled-error mb-4" data-testid="accounts-fetch-error">
		<p>Failed to load accounts: {data.fetchError}</p>
	</div>
{/if}

{#if data.accounts.length === 0 && !data.fetchError}
	<p class="text-surface-600-400" data-testid="accounts-empty">
		No accounts available to your user.
	</p>
{:else if data.accounts.length > 0}
	{#if bankOptions.length > 1}
		<div class="mb-4 flex max-w-2xl items-center gap-2" data-testid="bank-filter">
			<label for="bank-filter-input" class="text-sm text-surface-600-400">Bank:</label>
			<input
				id="bank-filter-input"
				class="input flex-1"
				type="text"
				list="bank-filter-options"
				bind:value={bankSearch}
				placeholder="All banks — type to filter"
				autocomplete="off"
				data-testid="bank-filter-input"
			/>
			<datalist id="bank-filter-options">
				{#each bankOptions as opt (opt.id)}
					<option value={`${opt.label} (${opt.id})`} data-testid="bank-filter-option" data-bank-id={opt.id}>{opt.id}</option>
				{/each}
			</datalist>
			{#if bankSearch}
				<button
					type="button"
					class="btn-icon btn-icon-sm"
					aria-label="Clear bank filter"
					onclick={() => (bankSearch = '')}
					data-testid="bank-filter-clear"
				>×</button>
			{/if}
		</div>
	{/if}

	{#if filteredAccounts.length === 0}
		<p class="text-surface-600-400" data-testid="accounts-filtered-empty">
			No accounts match "{bankSearch}".
		</p>
	{:else}
	<div class="table-container" data-testid="accounts-table">
		<table class="table-hover table">
			<thead>
				<tr>
					<th class="min-w-[18rem]">Account</th>
					<th>Type</th>
					<th>Routings</th>
					<th>Access</th>
					<th>Bank</th>
				</tr>
			</thead>
			<tbody>
				{#each tieredAccounts as tier (tier.key)}
					{#if tier.accounts.length > 0}
						<tr
							class={tierStyle[tier.key].header}
							data-testid="access-tier-heading"
							data-tier={tier.key}
						>
							<td colspan="5" class="px-3 py-2">
								<div class="flex flex-wrap items-baseline gap-2">
									<span class="text-xs font-semibold uppercase tracking-wide">{tier.label}</span>
									<span class="text-xs opacity-70">({tier.accounts.length})</span>
									<span class="text-xs opacity-70">— {tier.hint}</span>
								</div>
							</td>
						</tr>
						{#each tier.accounts as account (account.bank_id + '/' + account.id)}
							{@const href = accountHref(account.bank_id, account.id, account.views)}
							<tr
								class={tierStyle[tier.key].row}
								data-testid="account-row"
								data-bank-id={account.bank_id}
								data-account-id={account.id}
								data-access-tier={tier.key}
							>
								<td class="min-w-[18rem] whitespace-nowrap">
									<div>
										<a
											class="font-medium text-primary-500 hover:underline dark:text-primary-200"
											{href}
											data-testid="account-link"
										>{account.label}</a>
									</div>
									<a
										class="hover:underline"
										{href}
										data-testid="account-id-link"
									><code class="text-xs text-primary-500 dark:text-primary-200" data-testid="account-id">{account.id}</code></a>
								</td>
								<td>
									{#if account.account_type}
										<a
											class="text-primary-500 hover:underline dark:text-primary-200"
											href={`/financial-products/${encodeURIComponent(account.bank_id)}/${encodeURIComponent(account.account_type)}`}
											data-testid="account-type-link"
										>{account.account_type}</a>
									{:else}
										<span class="text-xs text-surface-600-400">—</span>
									{/if}
								</td>
								<td>
									{#if account.account_routings.length === 0}
										<span class="text-xs text-surface-600-400">—</span>
									{:else}
										<ul class="space-y-0.5" data-testid="account-routings">
											{#each account.account_routings as r}
												<li>
													<code class="text-xs" data-testid="account-routing" data-routing-scheme={r.scheme}>{r.scheme}: {r.address}</code>
												</li>
											{/each}
										</ul>
									{/if}
								</td>
								<td>
									{#if account.views.length === 0}
										<span class="text-xs text-surface-600-400">—</span>
									{:else}
										<ul class="flex flex-wrap gap-1" data-testid="account-views">
											{#each account.views as v (v.id)}
												<li>
													<a
														class="chip text-xs hover:underline {v.is_public ? 'variant-soft-warning' : 'variant-soft-primary'}"
														href={`/user/accounts/${encodeURIComponent(account.bank_id)}/${encodeURIComponent(account.id)}/${encodeURIComponent(v.id)}`}
														title={v.description || v.short_name}
														data-testid="account-view-chip"
														data-view-id={v.id}
														data-is-public={v.is_public}
													>{v.short_name || v.id}</a>
												</li>
											{/each}
										</ul>
									{/if}
								</td>
								<td>
									<div class="font-medium" data-testid="account-bank-name">{bankName(account.bank_id)}</div>
									<code class="text-xs text-surface-600-400" data-testid="account-bank-id">{account.bank_id}</code>
								</td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
	{/if}
{/if}
</div>
