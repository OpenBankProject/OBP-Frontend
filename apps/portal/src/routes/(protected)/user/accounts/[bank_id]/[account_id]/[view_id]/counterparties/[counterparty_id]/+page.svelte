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
	let { data } = $props();

	const accountHref = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/${encodeURIComponent(data.view_id)}`;
</script>

<svelte:head>
	<title>{data.counterparty?.name || data.counterparty_id} — Counterparty</title>
</svelte:head>

<nav class="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
	<a class="text-primary-500 hover:underline dark:text-primary-200" href="/user/accounts" data-testid="breadcrumb-accounts">Accounts</a>
	<span class="text-surface-500">›</span>
	<a class="text-primary-500 hover:underline dark:text-primary-200" href={accountHref} data-testid="breadcrumb-account"><code class="text-xs">{data.account_id}</code></a>
	<span class="text-surface-500">›</span>
	<span class="text-surface-600-400" data-testid="breadcrumb-current">Counterparty</span>
</nav>

<header class="mb-6" data-testid="counterparty-header">
	<h2 class="text-2xl font-semibold" data-testid="counterparty-name">
		{data.counterparty?.name || data.counterparty_id}
	</h2>
	<p class="mt-1 text-xs text-surface-600-400">
		<code>{data.bank_id}</code> / <code>{data.account_id}</code> / <code>{data.view_id}</code> / <code>{data.counterparty_id}</code>
	</p>
</header>

{#if data.fetchError}
	<div class="alert variant-filled-error mb-4" data-testid="counterparty-fetch-error">
		<p>Failed to load counterparty: {data.fetchError}</p>
	</div>
{:else if data.counterparty}
	{@const cp = data.counterparty}
	<section class="section-accent section-accent--info mb-6" data-testid="counterparty-info">
		<h3 class="section-accent-title mb-2 text-sm font-semibold uppercase">Counterparty information</h3>
		<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Counterparty ID</dt>
				<dd data-testid="counterparty-id"><code class="text-xs">{cp.counterparty_id}</code></dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Name</dt>
				<dd>{cp.name || '—'}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Description</dt>
				<dd>{cp.description || '—'}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Currency</dt>
				<dd>{cp.currency || '—'}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Beneficiary</dt>
				<dd data-testid="counterparty-is-beneficiary">
					{#if cp.is_beneficiary === true}
						<span class="chip variant-soft-success text-xs">Yes</span>
					{:else if cp.is_beneficiary === false}
						<span class="chip variant-soft-surface text-xs">No</span>
					{:else}
						—
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Created by user</dt>
				<dd><code class="text-xs">{cp.created_by_user_id || '—'}</code></dd>
			</div>
		</dl>
	</section>

	<section class="section-accent section-accent--routing mb-6" data-testid="counterparty-routing">
		<h3 class="section-accent-title mb-2 text-sm font-semibold uppercase">Routing</h3>
		<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Bank routing</dt>
				<dd>
					{#if cp.other_bank_routing_scheme || cp.other_bank_routing_address}
						<code class="text-xs">{cp.other_bank_routing_scheme}: {cp.other_bank_routing_address}</code>
					{:else}
						—
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Branch routing</dt>
				<dd>
					{#if cp.other_branch_routing_scheme || cp.other_branch_routing_address}
						<code class="text-xs">{cp.other_branch_routing_scheme}: {cp.other_branch_routing_address}</code>
					{:else}
						—
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase text-surface-600-400">Account routing</dt>
				<dd>
					{#if cp.other_account_routing_scheme || cp.other_account_routing_address}
						<code class="text-xs">{cp.other_account_routing_scheme}: {cp.other_account_routing_address}</code>
					{:else}
						—
					{/if}
				</dd>
			</div>
			{#if cp.other_account_secondary_routing_scheme || cp.other_account_secondary_routing_address}
				<div>
					<dt class="text-xs uppercase text-surface-600-400">Secondary account routing</dt>
					<dd>
						<code class="text-xs">{cp.other_account_secondary_routing_scheme}: {cp.other_account_secondary_routing_address}</code>
					</dd>
				</div>
			{/if}
		</dl>
	</section>

	{#if cp.metadata}
		<section class="section-accent section-accent--metadata mb-6" data-testid="counterparty-metadata">
			<h3 class="section-accent-title mb-2 text-sm font-semibold uppercase">Metadata</h3>
			<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-xs uppercase text-surface-600-400">Public alias</dt>
					<dd>{cp.metadata.public_alias || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase text-surface-600-400">Private alias</dt>
					<dd>{cp.metadata.private_alias || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase text-surface-600-400">More info</dt>
					<dd>{cp.metadata.more_info || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase text-surface-600-400">URL</dt>
					<dd>
						{#if cp.metadata.url}
							<a class="text-primary-500 hover:underline dark:text-primary-200" href={cp.metadata.url} target="_blank" rel="noopener noreferrer">{cp.metadata.url}</a>
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-xs uppercase text-surface-600-400">Image URL</dt>
					<dd>
						{#if cp.metadata.image_url}
							<a class="text-primary-500 hover:underline dark:text-primary-200" href={cp.metadata.image_url} target="_blank" rel="noopener noreferrer">{cp.metadata.image_url}</a>
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-xs uppercase text-surface-600-400">Open Corporates</dt>
					<dd>
						{#if cp.metadata.open_corporates_url}
							<a class="text-primary-500 hover:underline dark:text-primary-200" href={cp.metadata.open_corporates_url} target="_blank" rel="noopener noreferrer">{cp.metadata.open_corporates_url}</a>
						{:else}
							—
						{/if}
					</dd>
				</div>
			</dl>
		</section>
	{/if}

	{#if cp.bespoke && cp.bespoke.length > 0}
		<section class="section-accent section-accent--bespoke mb-6" data-testid="counterparty-bespoke">
			<h3 class="section-accent-title mb-2 text-sm font-semibold uppercase">Bespoke</h3>
			<div class="table-container">
				<table class="table">
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						{#each cp.bespoke as item}
							<tr data-testid="bespoke-row" data-bespoke-key={item.key}>
								<td><code class="text-xs">{item.key}</code></td>
								<td>{item.value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
{/if}
