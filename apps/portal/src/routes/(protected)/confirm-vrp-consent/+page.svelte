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
	import { isSafeExternalRedirect } from '@obp/shared/utils';

	let { data, form } = $props();

	// The server already picked an allowed redirect URL; checking again here means the browser never
	// navigates to a javascript: or other unsafe target, whatever reaches this page.
	$effect(() => {
		if (form?.success && isSafeExternalRedirect(form?.redirectUrl)) {
			window.location.href = form.redirectUrl;
		}
	});
</script>

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold ui-text">Confirm VRP Consent</h1>

		{#if data.loadError}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 ui-muted">
				Please enter the OTP code to finalise the VRP consent.
			</p>

			{#if form?.message}
				<div class="mb-4 rounded-lg border p-4 ui-tone-error">
					<p class="font-semibold ui-text-error">{form.message}</p>
				</div>
			{/if}

			{#if form?.success && !form?.redirectUrl}
				<div
					class="mb-4 rounded-lg border p-4 ui-tone-success"
				>
					<p class="font-semibold ui-text-success">{form.message}</p>
				</div>
			{:else if form?.success && form?.redirectUrl}
				<div
					class="mb-4 rounded-lg border p-4 ui-tone-success"
				>
					<p class="font-semibold ui-text-success">
						Consent confirmed. Redirecting...
					</p>
				</div>
			{:else}
				<form method="post" class="space-y-4">
					<input type="hidden" name="consentId" value={data.consentId} />

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

					<button type="submit" class="btn preset-filled-primary-500 w-full">Confirm</button>
				</form>
			{/if}
	</div>
