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

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold ui-text">OTP Verification</h1>

		{#if data.loadError}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 ui-muted">
				{#if data.flow === 'payment'}
					Please enter the OTP to authorise this payment.
				{:else}
					Please enter the OTP to authorise this transaction request.
				{/if}
			</p>

			{#if form?.message}
				<div class="mb-4 rounded-lg border p-4 ui-tone-error">
					<p class="font-semibold ui-text-error">{form.message}</p>
				</div>
			{/if}

			{#if form?.success}
				<div
					class="mb-4 rounded-lg border p-4 ui-tone-success"
				>
					<p class="font-semibold ui-text-success">{form.message}</p>
				</div>
			{:else}
				<form method="post" class="space-y-4">
					<input type="hidden" name="flow" value={data.flow} />

					{#if data.flow === 'payment'}
						<input type="hidden" name="paymentService" value={data.paymentService} />
						<input type="hidden" name="paymentProduct" value={data.paymentProduct} />
						<input type="hidden" name="paymentId" value={data.paymentId} />
					{:else}
						<input type="hidden" name="id" value={data.id} />
						<input type="hidden" name="bankId" value={data.bankId} />
						<input type="hidden" name="accountId" value={data.accountId} />
						<input type="hidden" name="viewId" value={data.viewId} />
						<input
							type="hidden"
							name="transactionRequestType"
							value={data.transactionRequestType}
						/>
						<input
							type="hidden"
							name="transactionRequestId"
							value={data.transactionRequestId}
						/>
					{/if}

					<div>
						<label
							for="otp"
							class="mb-1 block text-sm font-medium ui-muted"
						>
							OTP Code
						</label>
						<input
							id="otp"
							name="otp"
							type="text"
							required
							class="input w-full rounded-md border p-2 ui-panel ui-border"
							placeholder="Enter OTP code"
						/>
					</div>

					<button type="submit" class="btn preset-filled-primary-500 w-full">Verify OTP</button>
				</form>
			{/if}
	</div>
