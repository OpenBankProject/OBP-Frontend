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

	<!-- Status Card -->
	<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 mb-8">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
			Service Status
		</h2>

		{#if data.status === 'available'}
			<div class="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
				<CircleCheck class="h-5 w-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
				<div>
					<p class="font-medium text-green-700 dark:text-green-300">Available</p>
					<p class="text-sm text-green-600 dark:text-green-400">{data.statusMessage}</p>
				</div>
			</div>
		{:else if data.status === 'not_configured'}
			<div class="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/30">
				<Settings class="h-5 w-5 mt-0.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
				<div>
					<p class="font-medium text-gray-700 dark:text-gray-300">Not Configured</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">{data.statusMessage}</p>
				</div>
			</div>
		{:else if data.status === 'error'}
			<div class="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
				<CircleAlert class="h-5 w-5 mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
				<div>
					<p class="font-medium text-yellow-700 dark:text-yellow-300">Error</p>
					<p class="text-sm text-yellow-600 dark:text-yellow-400">{data.statusMessage}</p>
				</div>
			</div>
		{:else}
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
				<CircleX class="h-5 w-5 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
				<div>
					<p class="font-medium text-red-700 dark:text-red-300">Unavailable</p>
					<p class="text-sm text-red-600 dark:text-red-400">{data.statusMessage}</p>
				</div>
			</div>
		{/if}

		{#if data.subscriptionsUrl}
			<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
				Host: <code class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">{data.subscriptionsUrl}</code>
			</p>
		{/if}
	</div>

	<!-- Action -->
	<div class="text-center">
		{#if data.status === 'available'}
			<a
				href={data.subscriptionsUrl}
				target="_blank"
				rel="noopener noreferrer"
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
</div>
