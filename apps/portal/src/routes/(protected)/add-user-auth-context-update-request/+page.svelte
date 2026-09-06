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
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Onboarding</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				Please enter your {data.key.replace(/_/g, ' ').toLowerCase()} to begin the verification
				process.
			</p>

			{#if form?.message}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.message}</p>
				</div>
			{/if}

			<form method="post" class="space-y-4">
				<input type="hidden" name="bankId" value={data.bankId} />
				<input type="hidden" name="scaMethod" value={data.scaMethod} />
				<input type="hidden" name="key" value={data.key} />

				<div>
					<label
						for="value"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						{data.key.replace(/_/g, ' ')}
					</label>
					<input
						id="value"
						name="value"
						type="text"
						required
						class="input w-full rounded-md border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-800"
						placeholder="Enter your {data.key.replace(/_/g, ' ').toLowerCase()}"
					/>
				</div>

				<p class="text-sm text-gray-500 dark:text-gray-400">
					Bank: <strong>{data.bankId}</strong> | SCA Method: <strong>{data.scaMethod}</strong>
				</p>

				<button type="submit" class="btn preset-filled-primary-500 w-full">Submit</button>
			</form>
	</div>
