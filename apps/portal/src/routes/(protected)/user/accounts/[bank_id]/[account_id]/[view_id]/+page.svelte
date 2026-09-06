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
	import type { LoadError, LoadErrorCategory } from './types';

	let { data } = $props();

	function fmtDate(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString();
	}

	function fmtAmount(amount: string | undefined, currency: string | undefined): string {
		if (!amount) return '';
		if (!currency) return amount;
		return `${amount} ${currency}`;
	}

	async function onViewChange(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value;
		if (!next || next === data.view_id) return;
		const url = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/${encodeURIComponent(next)}`;
		await goto(url, { invalidateAll: true });
	}

	const mandatesHref = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/mandates`;

	function errorHeadline(err: LoadError, target: 'account' | 'transactions'): string {
		const subject = target === 'account' ? 'this account' : 'these transactions';
		switch (err.category as LoadErrorCategory) {
			case 'access':
				return `You don't have access to ${subject} via the "${data.view_id}" view.`;
			case 'not_found':
				return target === 'account'
					? `Account or view not found at ${data.bank_id}.`
					: `Transactions are not available for this account on the "${data.view_id}" view.`;
			case 'unauthorized':
				return 'You are not signed in, or your session has expired.';
			case 'rate_limit':
				return 'The API rate limit was exceeded — please wait a moment and retry.';
			case 'timeout':
				return 'The request to the OBP-API timed out.';
			default:
				return target === 'account'
					? 'Could not load the account details.'
					: 'Could not load transactions.';
		}
	}

	const accessibleViews = $derived(data.availableViews.filter((v) => v.has_access));
	const otherAccessibleViews = $derived(accessibleViews.filter((v) => v.id !== data.view_id));
	const currentViewAccessible = $derived(
		data.availableViews.find((v) => v.id === data.view_id)?.has_access ?? false
	);
</script>

<div class="mx-auto max-w-7xl py-2">
<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<div class="flex flex-wrap items-center gap-4">
		<a class="text-sm text-primary-500 hover:underline dark:text-primary-200" href="/user/accounts" data-testid="back-to-accounts">← All accounts</a>
		<a class="text-sm text-primary-500 hover:underline dark:text-primary-200" href={mandatesHref} data-testid="account-mandates-link">Mandates →</a>
	</div>

	{#if data.availableViews.length > 0}
		<label class="flex items-center gap-2 text-sm" data-testid="view-picker">
			<span class="text-surface-600-400">View:</span>
			<select
				class="select"
				name="view_id"
				onchange={onViewChange}
				data-testid="view-picker-select"
			>
				{#each data.availableViews as v (v.id)}
					<option
						value={v.id}
						selected={v.id === data.view_id}
						disabled={!v.has_access && v.id !== data.view_id}
						data-testid="view-option"
						data-view-id={v.id}
						data-has-access={v.has_access}
					>{v.short_name} ({v.id}){v.has_access ? '' : ' — no access'}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

<section
	class="section-accent section-accent--access mb-6 bg-surface-50-900 py-2"
	data-testid="your-access"
	data-current-view-accessible={currentViewAccessible}
>
	<div class="mb-3 flex flex-wrap items-center gap-3">
		<h3 class="section-accent-title text-sm font-semibold uppercase">Your access</h3>
		{#if currentViewAccessible}
			<span class="chip variant-soft-success text-xs" data-testid="current-view-access-badge">✓ accessible via "{data.view_id}"</span>
		{:else}
			<span class="chip variant-soft-error text-xs" data-testid="current-view-access-badge">⛔ no access via "{data.view_id}"</span>
		{/if}
		<span class="text-xs text-surface-600-400" data-testid="accessible-views-count">
			{accessibleViews.length} of {data.availableViews.length} view{data.availableViews.length === 1 ? '' : 's'} accessible
		</span>
	</div>

	<div>
		<div class="text-xs uppercase text-surface-600-400">Views you can use on this account</div>
		<div class="mt-1 flex flex-wrap gap-1" data-testid="accessible-views-list">
			{#if accessibleViews.length === 0}
				<span class="text-xs text-surface-600-400">None — ask an admin to grant a view.</span>
			{:else}
				{#each accessibleViews as v (v.id)}
					<a
						class="chip text-xs hover:underline {v.id === data.view_id ? 'variant-filled-primary' : v.is_public ? 'variant-soft-warning' : 'variant-soft-primary'}"
						href={`/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/${encodeURIComponent(v.id)}`}
						title={v.description || v.short_name}
						data-testid="your-access-view-chip"
						data-view-id={v.id}
						data-is-public={v.is_public}
						data-is-current={v.id === data.view_id}
					>{v.short_name || v.id}</a>
				{/each}
			{/if}
		</div>
	</div>
</section>

{#if data.accountError}
	<div
		class="mb-6 rounded-lg border border-error-500 bg-error-500/10 p-4"
		role="alert"
		data-testid="account-fetch-error"
		data-error-category={data.accountError.category}
		data-error-status={data.accountError.status}
	>
		<p class="text-base font-semibold text-error-700-300">
			{errorHeadline(data.accountError, 'account')}
		</p>
		<p class="mt-1 text-sm text-surface-700-300" data-testid="account-fetch-error-detail">
			<code class="text-xs">{data.accountError.status}</code>
			{#if data.accountError.obpCode}
				· <code class="text-xs">{data.accountError.obpCode}</code>
			{/if}
			· {data.accountError.message}
		</p>
		{#if data.accountError.category === 'access' && otherAccessibleViews.length > 0}
			<p class="mt-3 text-sm">
				Views you can access on this account:
				{#each otherAccessibleViews as v, i (v.id)}
					{#if i > 0},{' '}{/if}
					<a
						class="text-primary-500 hover:underline dark:text-primary-200"
						href={`/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/${encodeURIComponent(v.id)}`}
						data-testid="suggested-view-link"
						data-view-id={v.id}
					>{v.short_name || v.id}</a>
				{/each}.
			</p>
		{:else if data.accountError.category === 'access' && accessibleViews.length === 0}
			<p class="mt-3 text-sm text-surface-700-300">
				You currently have no accessible views on this account. Ask an account holder or admin to grant you a view.
			</p>
		{/if}
	</div>
{/if}

{#if data.account}
	<section class="section-accent section-accent--info mb-6" data-testid="account-summary">
		<h2 class="section-accent-title text-2xl font-semibold">{data.account.label}</h2>
		<dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Bank</dt>
				<dd data-testid="account-bank-id"><code>{data.bank_id}</code></dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Account ID</dt>
				<dd data-testid="account-id"><code>{data.account_id}</code></dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">View</dt>
				<dd data-testid="account-view-id"><code>{data.view_id}</code></dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Type</dt>
				<dd data-testid="account-type">{data.account.account_type}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Balance</dt>
				<dd data-testid="account-balance">
					{#if data.account.balance}
						<strong>{fmtAmount(data.account.balance.amount, data.account.balance.currency)}</strong>
					{:else}
						<span class="text-surface-500">Not available</span>
					{/if}
				</dd>
			</div>
		</dl>

		{#if data.account.account_routings.length > 0}
			<div class="mt-4">
				<h3 class="text-sm font-semibold uppercase text-surface-600-400">Routings</h3>
				<ul class="mt-2 space-y-1" data-testid="account-routings">
					{#each data.account.account_routings as r}
						<li><code class="text-xs">{r.scheme}: {r.address}</code></li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>
{/if}

<section class="section-accent section-accent--transactions mb-6" data-testid="recent-transactions">
	<h3 class="section-accent-title mb-2 text-xl font-semibold">Recent transactions</h3>

	{#if data.transactionsError}
		<div
			class="mb-4 rounded-lg border border-warning-500 bg-warning-500/10 p-4"
			role="alert"
			data-testid="transactions-fetch-error"
			data-error-category={data.transactionsError.category}
			data-error-status={data.transactionsError.status}
		>
			<p class="text-base font-semibold text-warning-700-300">
				{errorHeadline(data.transactionsError, 'transactions')}
			</p>
			<p class="mt-1 text-sm text-surface-700-300" data-testid="transactions-fetch-error-detail">
				<code class="text-xs">{data.transactionsError.status}</code>
				{#if data.transactionsError.obpCode}
					· <code class="text-xs">{data.transactionsError.obpCode}</code>
				{/if}
				· {data.transactionsError.message}
			</p>
		</div>
	{/if}

	{#if data.transactions.length === 0 && !data.transactionsError}
		<p class="text-surface-600-400" data-testid="transactions-empty">No transactions to display.</p>
	{:else if data.transactions.length > 0}
		<div class="table-container">
			<table class="table-hover table">
				<thead>
					<tr>
						<th>Posted</th>
						<th>Description</th>
						<th>Counterparty</th>
						<th class="text-right">Amount</th>
						<th class="text-right">Balance after</th>
					</tr>
				</thead>
				<tbody>
					{#each data.transactions as tx, i (tx.id ?? `idx-${i}`)}
						<tr data-testid="transaction-row" data-transaction-id={tx.id}>
							<td>{fmtDate(tx.posted)}</td>
							<td>{tx.description}</td>
							<td>
								{#if tx.counterparty_id}
									<a
										class="text-primary-500 hover:underline dark:text-primary-200"
										href={`/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/${encodeURIComponent(data.view_id)}/counterparties/${encodeURIComponent(tx.counterparty_id)}`}
										data-testid="transaction-counterparty-link"
										data-counterparty-id={tx.counterparty_id}
									>{tx.other_holder || tx.counterparty_id}</a>
								{:else}
									{tx.other_holder}
								{/if}
							</td>
							<td class="text-right">{fmtAmount(tx.amount, tx.currency)}</td>
							<td class="text-right">{fmtAmount(tx.new_balance_amount, tx.currency)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
</div>
