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
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl p-8">
		<h1 class="mb-4 text-2xl font-bold ui-text">Consent Request</h1>

		{#if data.loadError}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 ui-muted">
				<strong>{data.consumerName}</strong> is requesting access to your account information.
			</p>

			{#if form?.message}
				<div class="mb-4 rounded-lg border p-4 ui-tone-error">
					<p class="font-semibold ui-text-error">{form.message}</p>
				</div>
			{/if}

			<!-- Permissions Requested -->
			<div class="mb-6 rounded-lg p-6 shadow-md ui-card">
				<h2 class="mb-4 text-lg font-semibold ui-text">
					Permissions Requested
				</h2>
				<div class="space-y-2">
					{#if data.hasAccountAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full preset-filled-primary-500"></span>
							<span class="ui-muted">Read account details</span>
						</div>
					{/if}
					{#if data.hasBalanceAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full preset-filled-primary-500"></span>
							<span class="ui-muted">Read balances</span>
						</div>
					{/if}
					{#if data.hasTransactionAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full preset-filled-primary-500"></span>
							<span class="ui-muted">Read transactions</span>
						</div>
					{/if}
				</div>

				{#if data.validUntil}
					<p class="mt-4 text-sm ui-muted">
						Valid until: <strong>{data.validUntil}</strong>
					</p>
				{/if}
			</div>

			<!-- Account Selection -->
			{#if data.needsAccountSelection && data.userIbans.length > 0}
				<div class="mb-6 rounded-lg p-6 shadow-md ui-card">
					<h2 class="mb-4 text-lg font-semibold ui-text">
						Select Accounts
					</h2>
					<p class="mb-4 text-sm ui-muted">
						Please select the accounts you want to grant access to:
					</p>
					<form method="post" action="?/confirm" id="confirmForm">
						<input type="hidden" name="consentId" value={data.consentId} />
						<input type="hidden" name="hasBalanceAccess" value={String(data.hasBalanceAccess)} />
						<input
							type="hidden"
							name="hasTransactionAccess"
							value={String(data.hasTransactionAccess)}
						/>
						<div class="space-y-3">
							{#each data.userIbans as account}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-md border p-3 ui-hover ui-border"
								>
									<input
										type="checkbox"
										name="selectedIbans"
										value={account.iban}
										checked={data.preSelectedIbans.includes(account.iban)}
										class="checkbox"
									/>
									<div>
										<span class="font-medium ui-text"
											>{account.label}</span
										>
										<span class="ml-2 text-sm ui-muted"
											>{account.iban}</span
										>
									</div>
								</label>
							{/each}
						</div>
					</form>
				</div>
			{:else if data.allAccountsRequested}
				<div class="mb-6 rounded-lg p-4 ui-tone-info">
					<p class="text-sm ui-link">
						Access is requested for all your accounts.
					</p>
				</div>
			{:else if data.preSelectedIbans.length > 0}
				<div class="mb-6 rounded-lg p-6 shadow-md ui-card">
					<h2 class="mb-4 text-lg font-semibold ui-text">Accounts</h2>
					<div class="space-y-2">
						{#each data.preSelectedIbans as iban}
							<div class="rounded-md border p-3 ui-border">
								<span class="ui-text">{iban}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-4">
				{#if data.needsAccountSelection}
					<button type="submit" form="confirmForm" class="btn preset-filled-primary-500 flex-1">
						Confirm
					</button>
				{:else}
					<form method="post" action="?/confirm" class="flex-1">
						<input type="hidden" name="consentId" value={data.consentId} />
						<input type="hidden" name="hasBalanceAccess" value={String(data.hasBalanceAccess)} />
						<input
							type="hidden"
							name="hasTransactionAccess"
							value={String(data.hasTransactionAccess)}
						/>
						<button type="submit" class="btn preset-filled-primary-500 w-full">Confirm</button>
					</form>
				{/if}

				<form method="post" action="?/deny" class="flex-1">
					<input type="hidden" name="consentId" value={data.consentId} />
					<button type="submit" class="btn preset-filled-error-500 w-full">Deny</button>
				</form>
			</div>
	</div>
