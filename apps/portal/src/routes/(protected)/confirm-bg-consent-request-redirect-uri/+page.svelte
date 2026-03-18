<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	function redirectToTpp() {
		if (data.tppRedirectUri) {
			window.location.href = data.tppRedirectUri;
		}
	}

	// Auto-redirect fallback: if the TPP app link doesn't work within 2 seconds,
	// try the nok redirect URI
	onMount(() => {
		if (data.tppRedirectUri) {
			const timeout = setTimeout(() => {
				if (data.tppNokRedirectUri) {
					window.location.href = data.tppNokRedirectUri;
				}
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
					Your consent has been successfully confirmed. Status: <strong>{data.status}</strong>
				</p>
			</div>

			{#if data.tppRedirectUri}
				<p class="mb-4 text-gray-700 dark:text-gray-300">
					Click the button below to return to the application.
				</p>
				<button onclick={redirectToTpp} class="btn preset-filled-primary-500"> Ok </button>
			{:else}
				<p class="text-gray-700 dark:text-gray-300">
					You may now close this window or <a href="/" class="text-primary-500 hover:underline"
						>return to the home page</a
					>.
				</p>
			{/if}
	</div>
