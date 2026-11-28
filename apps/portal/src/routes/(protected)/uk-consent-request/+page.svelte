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

	// SvelteKit's `?/actionName` shorthand REPLACES the page's entire query string, not
	// appends to it. Since load() requires CONSENT_ID/bank_id from the URL, submitting a
	// bare "?/confirm" strips them -- on any non-redirecting action response (e.g. a
	// validation failure) load() re-runs against the stripped URL and throws its own
	// "Missing required parameter" error, masking the action's real message. Preserve the
	// existing query string per SvelteKit's documented convention (append with "&").
	let actionQuery = $derived(
		new URLSearchParams({
			CONSENT_ID: data.consentId,
			bank_id: data.bankId,
			api_standard: data.apiStandard,
			oidc_return_url: data.oidcReturnUrl
		}).toString()
	);
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-4 text-2xl font-bold ui-text">
		UK Open Banking Consent
	</h1>

	{#if data.loadError}
		<div class="mb-4 rounded-lg border p-4 ui-tone-error">
			<p class="font-semibold ui-text-error">{data.loadError}</p>
		</div>
	{:else}
		<p class="mb-6 ui-muted">
			An application is requesting access to your account information via UK Open Banking.
			Please review the details below and confirm if you agree.
		</p>

		{#if form?.message}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{form.message}</p>
			</div>
		{/if}

		<!-- Consent Details -->
		<div class="mb-6 rounded-lg p-6 shadow-md ui-card">
			<h2 class="mb-4 text-lg font-semibold ui-text">
				Consent Details
			</h2>

			<div class="grid gap-3 text-sm">
				<div class="flex items-center justify-between">
					<span class="font-medium ui-muted">Standard:</span>
					<span class="ui-text">
						{data.apiStandard === 'UKOpenBankingV401' ? 'UK Open Banking v4.0.1' : 'UK Open Banking'}
					</span>
				</div>
				{#if data.bankId}
					<div class="flex items-center justify-between">
						<span class="font-medium ui-muted">Bank:</span>
						<span class="ui-text">{data.bankId}</span>
					</div>
				{/if}
				<div class="flex items-center justify-between">
					<span class="font-medium ui-muted">Consent ID:</span>
					<span class="font-mono text-xs ui-text">{data.consentId}</span>
				</div>
				{#if data.status}
					<div class="flex items-center justify-between">
						<span class="font-medium ui-muted">Status:</span>
						<span class="ui-text">{data.status}</span>
					</div>
				{/if}
				{#if data.expirationDateTime}
					<div class="flex items-center justify-between">
						<span class="font-medium ui-muted">Expires:</span>
						<span class="ui-text">{data.expirationDateTime}</span>
					</div>
				{/if}
			</div>

			{#if data.permissions?.length}
				<div class="mt-4 border-t pt-4 ui-border">
					<h3 class="mb-2 text-sm font-semibold ui-text">
						Permissions requested ({data.permissions.length})
					</h3>
					<ul class="grid grid-cols-2 gap-1 text-sm">
						{#each data.permissions as permission}
							<li class="ui-text">{permission}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<!-- Account Selection -->
		<div class="mb-6 rounded-lg p-6 shadow-md ui-card">
			<h2 class="mb-4 text-lg font-semibold ui-text">
				Select Accounts
			</h2>
			{#if data.userAccounts?.length}
				<p class="mb-4 text-sm ui-muted">
					Choose which of your accounts the requested permissions apply to:
				</p>
				<div class="space-y-3" data-testid="uk-consent-account-list">
					{#each data.userAccounts as account}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md border p-3 ui-hover ui-border"
						>
							<input
								type="checkbox"
								name="selectedAccountIds"
								form="confirmForm"
								value={account.accountId}
								class="checkbox"
								data-testid="uk-consent-account-checkbox"
							/>
							<div>
								<span class="font-medium ui-text">{account.label}</span>
								<span class="ml-2 font-mono text-xs ui-muted"
									>{account.accountId}</span
								>
							</div>
						</label>
					{/each}
				</div>
			{:else if data.accountsError}
				<!--
					The list failed to load. "You have no accounts" is a claim about the PSU, and a
					failed call is no evidence for it -- a PSU who does hold accounts here would be
					told they do not, with no reason and no way to retry.
				-->
				<p class="text-sm ui-text-error" data-testid="uk-consent-accounts-error">
					{data.accountsError}
				</p>
			{:else}
				<p class="text-sm ui-text-error" data-testid="uk-consent-no-accounts">
					You have no accounts at this bank, so this consent cannot be authorised.
				</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex gap-4">
			<form method="post" action="?{actionQuery}&/confirm" id="confirmForm" class="flex-1">
				<input type="hidden" name="consentId" value={data.consentId} />
				<input type="hidden" name="bankId" value={data.bankId} />
				<input type="hidden" name="oidcReturnUrl" value={data.oidcReturnUrl} />
				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full"
					disabled={!data.userAccounts?.length}
				>
					Confirm Consent
				</button>
			</form>
			<form method="post" action="?{actionQuery}&/deny" class="flex-1">
				<input type="hidden" name="oidcReturnUrl" value={data.oidcReturnUrl} />
				<button type="submit" class="btn preset-filled-error-500 w-full">
					Deny
				</button>
			</form>
		</div>
	{/if}
</div>
