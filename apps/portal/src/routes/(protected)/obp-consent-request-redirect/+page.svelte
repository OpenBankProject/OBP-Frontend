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

	let { data } = $props();

	function redirectToOidc() {
		if (data.oidcReturnUrl) {
			window.location.href = data.oidcReturnUrl;
		}
	}

	// Auto-redirect after a brief delay
	onMount(() => {
		if (data.oidcReturnUrl) {
			const timeout = setTimeout(() => {
				redirectToOidc();
			}, 2000);

			return () => clearTimeout(timeout);
		}
	});
</script>

<div class="mx-auto max-w-lg p-8 text-center">
		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<div
				class="mb-6 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20"
			>
				<h1 class="mb-2 text-2xl font-bold text-green-600 dark:text-green-400">
					Consent Confirmed
				</h1>
				<p class="text-green-700 dark:text-green-300">
					Your consent has been successfully confirmed. You will be redirected back to the application.
				</p>
			</div>

			{#if data.oidcReturnUrl}
				<p class="mb-4 text-gray-700 dark:text-gray-300">
					Redirecting you back to the application...
				</p>
				<button onclick={redirectToOidc} class="btn preset-filled-primary-500">
					Continue
				</button>
			{:else}
				<p class="text-gray-700 dark:text-gray-300">
					You may now close this window or <a href="/" class="text-primary-500 hover:underline"
						>return to the home page</a
					>.
				</p>
			{/if}
	</div>
