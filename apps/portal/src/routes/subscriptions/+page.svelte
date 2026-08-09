<script lang="ts">
	import { ExternalLink, CircleCheck, CircleAlert, CircleX, Settings } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Subscriptions</title>
	<meta name="description" content="Manage your API subscriptions" />
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Subscriptions</h1>
		<p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
			Manage your API subscriptions and billing through the OBP Subscriptions service.
		</p>
	</div>

	<!-- Action -->
	<div class="mb-8 text-center">
		{#if data.status === 'available'}
			<a
				href={data.subscriptionsUrl}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="subscriptions-link"
				class="btn preset-filled-primary-500 inline-flex items-center gap-2 px-8 py-3 text-lg"
			>
				Go to Subscriptions
				<ExternalLink class="h-5 w-5" />
			</a>
		{:else if data.subscriptionsUrl}
			<a
				href={data.subscriptionsUrl}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="subscriptions-link"
				class="btn preset-outlined-surface-500 inline-flex items-center gap-2 px-8 py-3 opacity-75"
			>
				Try Anyway
				<ExternalLink class="h-5 w-5" />
			</a>
			<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
				The service may be temporarily unavailable. You can still try to access it.
			</p>
		{:else}
			<p class="text-gray-500 dark:text-gray-400">
				Please configure <code class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">PUBLIC_SUBSCRIPTIONS_URL</code> in the environment to enable this feature.
			</p>
		{/if}
	</div>

	<!-- Status -->
	<div class="text-center text-sm" data-testid="subscriptions-status" data-status={data.status}>
		{#if data.status === 'available'}
			<p class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<CircleCheck class="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
				Service status: <span class="font-medium text-green-700 dark:text-green-300">Available</span>
			</p>
		{:else if data.status === 'not_configured'}
			<p class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<Settings class="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
				Service status: <span class="font-medium text-gray-700 dark:text-gray-300">Not Configured</span>
			</p>
		{:else if data.status === 'error'}
			<p class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<CircleAlert class="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
				Service status: <span class="font-medium text-yellow-700 dark:text-yellow-300">Error</span>
			</p>
		{:else}
			<p class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<CircleX class="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
				Service status: <span class="font-medium text-red-700 dark:text-red-300">Unavailable</span>
			</p>
		{/if}
		{#if data.statusMessage}
			<p class="mt-1 text-gray-500 dark:text-gray-400">{data.statusMessage}</p>
		{/if}
		{#if data.subscriptionsUrl}
			<p class="mt-1 text-gray-500 dark:text-gray-400">
				Host: <code class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">{data.subscriptionsUrl}</code>
			</p>
		{/if}
	</div>
</div>
