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
		<h1 class="mb-4 text-2xl font-bold ui-text">
			Confirm VRP Consent Request
		</h1>

		{#if data.loadError}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 ui-muted">
				Please review the Variable Recurring Payment consent details below and confirm if you agree.
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

				{#if data.format === 'text' || data.format === 'both'}
					<div class="mb-4 rounded p-4 ui-card">
						<pre
							class="whitespace-pre-wrap text-sm ui-muted">{JSON.stringify(data.payload, null, 2)}</pre>
					</div>
				{/if}

				{#if data.format === 'structured' || data.format === 'both'}
					<div class="grid gap-3 text-sm">
						{#if data.payload.from_account}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted">From Account:</span
								>
								<span class="ui-text"
									>{JSON.stringify(data.payload.from_account)}</span
								>
							</div>
						{/if}

						{#if data.payload.to_account}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted">To Account:</span>
								<span class="ui-text"
									>{JSON.stringify(data.payload.to_account)}</span
								>
							</div>
						{/if}

						{#if data.payload.maximum_single_amount}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted"
									>Max Single Amount:</span
								>
								<span class="ui-text">
									{data.payload.maximum_single_amount.amount}
									{data.payload.maximum_single_amount.currency}
								</span>
							</div>
						{/if}

						{#if data.payload.maximum_monthly_amount}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted"
									>Max Monthly Amount:</span
								>
								<span class="ui-text">
									{data.payload.maximum_monthly_amount.amount}
									{data.payload.maximum_monthly_amount.currency}
								</span>
							</div>
						{/if}

						{#if data.payload.valid_from}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted">Valid From:</span>
								<span class="ui-text"
									>{data.payload.valid_from}</span
								>
							</div>
						{/if}

						{#if data.payload.valid_to}
							<div class="flex items-center justify-between">
								<span class="font-medium ui-muted">Valid Until:</span
								>
								<span class="ui-text"
									>{data.payload.valid_to}</span
								>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<form method="post" action="?/confirm">
				<input type="hidden" name="consentRequestId" value={data.consentRequestId} />
				<button type="submit" class="btn preset-filled-primary-500 w-full">
					Confirm Consent
				</button>
			</form>
	</div>
