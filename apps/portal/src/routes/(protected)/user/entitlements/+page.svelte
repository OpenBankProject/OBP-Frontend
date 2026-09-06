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
	interface Entitlement {
		entitlement_id: string;
		role_name: string;
		bank_id: string;
	}

	const { data, form } = $props();
	const userEntitlements = data.userEntitlements as Entitlement[];
	const allEntitlements = data.allAvailableEntitlements;
	const allBanks = data.allBanks;

	const canCreateEntitlements = userEntitlements.some((entitlement) =>
		['CanCreateEntitlementAtAnyBank', 'CanCreateEntitlementAtOneBank'].includes(
			entitlement.role_name
		)
	);

	const bankNameById = new Map<string, string>(
		allBanks.map((b: { bank_id: string; name: string }) => [b.bank_id, b.name])
	);

	const groupedEntitlements = (() => {
		const byBank = new Map<string, Entitlement[]>();
		for (const e of userEntitlements) {
			const key = e.bank_id || '';
			if (!byBank.has(key)) byBank.set(key, []);
			byBank.get(key)!.push(e);
		}
		for (const list of byBank.values()) {
			list.sort((a, b) => a.role_name.localeCompare(b.role_name));
		}
		const groups: { bank_id: string; label: string; entitlements: Entitlement[] }[] = [];
		if (byBank.has('')) {
			groups.push({ bank_id: '', label: 'System-wide', entitlements: byBank.get('')! });
		}
		const bankKeys = Array.from(byBank.keys()).filter((k) => k !== '');
		bankKeys.sort((a, b) => {
			const na = bankNameById.get(a) || a;
			const nb = bankNameById.get(b) || b;
			return na.localeCompare(nb);
		});
		for (const k of bankKeys) {
			groups.push({ bank_id: k, label: bankNameById.get(k) || k, entitlements: byBank.get(k)! });
		}
		return groups;
	})();

	let selectedEntitlementRole = $state('');
	let selectedBankId = $state('');

	// Derived state to get the full entitlement object
	let selectedEntitlement = $derived(
		allEntitlements.find((ent) => ent.role === selectedEntitlementRole) || { role: '', requires_bank_id: false }
	);

	// Pre-select entitlement if form data exists (on validation errors)
	if (form?.entitlement && !form?.success) {
		selectedEntitlementRole = String(form.entitlement);
	}

	if (form?.bank_id && !form?.success) {
		selectedBankId = String(form.bank_id);
	}

	// Reset form on success
	if (form?.success) {
		selectedEntitlementRole = '';
		selectedBankId = '';
	}
</script>

<h2 class="mb-4 text-xl font-semibold">Your Entitlements</h2>

{#if userEntitlements.length > 0}
	<div class="space-y-6" data-testid="entitlement-groups">
		{#each groupedEntitlements as group (group.bank_id || 'system')}
			<section data-testid="entitlement-group" data-bank-id={group.bank_id}>
				<header class="mb-2 flex flex-wrap items-baseline gap-2">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-surface-700-300">
						{group.label}
					</h3>
					{#if group.bank_id}
						<code class="text-xs text-surface-600-400">{group.bank_id}</code>
					{/if}
					<span class="text-xs text-surface-600-400">
						{group.entitlements.length} role{group.entitlements.length === 1 ? '' : 's'}
					</span>
				</header>
				<ul
					class="columns-1 gap-x-6 sm:columns-2 md:columns-3"
					data-testid="entitlement-list"
				>
					{#each group.entitlements as e (e.entitlement_id)}
						<li
							class="break-inside-avoid py-0.5"
							data-testid="entitlement-item"
							data-role-name={e.role_name}
							data-entitlement-id={e.entitlement_id}
							title={`entitlement_id: ${e.entitlement_id}`}
						>
							<span class="text-sm" data-testid="entitlement-role-name">{e.role_name}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}

{#if canCreateEntitlements}
	<h2 class="mt-8 mb-4 text-xl font-semibold">Add New Entitlement</h2>

	{#if form?.success}
		<div class="alert variant-filled-success mb-4">
			<p>{form.message}</p>
		</div>
	{/if}

	<form method="POST" action="?/create" class="mx-auto w-full max-w-md space-y-4">
		<label class="label">
			<span class="label-text">Select Entitlement</span>
			<select class="select" name="entitlement" bind:value={selectedEntitlementRole}>
				<option value="" disabled>Select an entitlement</option>
				{#each allEntitlements as ent}
					<option value={ent.role}>{ent.role}</option>
				{/each}
			</select>
		</label>

		{#if form?.missing}<p class="text-error-500 text-xs">Please select an entitlement to add.</p>{/if}
		{#if form?.message}<p class="text-error-500 text-xs">{form.message}</p>{/if}

		{#if selectedEntitlement.requires_bank_id}
			<label class="label">
				<span class="label-text">Select Bank</span>
				<select class="select" name="bank_id" bind:value={selectedBankId}>
					<option value="" disabled>Select a bank</option>
					{#each allBanks as bank}
						<option value={bank.bank_id}>{bank.name} ({bank.bank_id})</option>
					{/each}
				</select>
			</label>
		{/if}
        <button class="btn preset-outlined-tertiary-500" type="submit">Add Entitlement</button>
	</form>
{:else if !canCreateEntitlements}
	<h2 class="mt-8 mb-4 text-xl font-semibold">Request Entitlement</h2>
{/if}
