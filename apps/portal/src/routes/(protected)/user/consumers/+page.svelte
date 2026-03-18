<script lang="ts">
	let { data } = $props();
	const consumers = data.consumers;

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return date.toLocaleString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'Unknown date';
		}
	}
</script>

<h1 class="text-gray-900 dark:text-gray-100">API Consumers</h1>

<p class="mb-4 text-gray-700 dark:text-gray-300">
	Here you can view your registered API consumers.
</p>

<!-- Security Notice -->
<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
	<div class="flex items-start">
		<svg
			class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fill-rule="evenodd"
				d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
				clip-rule="evenodd"
			/>
		</svg>
		<div>
			<h3 class="text-sm font-medium text-blue-900 dark:text-blue-100">
				Important: Credential Security
			</h3>
			<p class="mt-1 text-sm text-blue-800 dark:text-blue-200">
				Consumer keys and secrets are only displayed once at creation time for security reasons. 
				Make sure to save them securely when creating a new consumer. If you lose your credentials, 
				you'll need to <a href="/consumers/register" class="underline font-medium hover:text-blue-900 dark:hover:text-blue-100">create a new consumer</a>.
			</p>
		</div>
	</div>
</div>

{#if consumers && consumers.length > 0}
	<div class="space-y-4">
		{#each consumers as consumer (consumer.consumer_id)}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<!-- Header with App Name and Status -->
				<div class="mb-4 flex items-start justify-between">
					<div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
							{consumer.app_name}
						</h2>
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
							Created: {formatDate(consumer.created)}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-full px-3 py-1 text-xs font-medium {consumer.enabled
								? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
								: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}"
						>
							{consumer.enabled ? 'Enabled' : 'Disabled'}
						</span>
						<span
							class="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
						>
							{consumer.app_type}
						</span>
					</div>
				</div>

				<!-- Description -->
				{#if consumer.description}
					<p class="mb-4 text-sm text-gray-700 dark:text-gray-300">
						{consumer.description}
					</p>
				{/if}

				<!-- Credentials Section -->
				<div class="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Consumer ID -->
						<div class="sm:col-span-2">
							<div class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
								Consumer ID
							</div>
							<code
								class="block rounded bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
							>
								{consumer.consumer_id}
							</code>
						</div>

						{#if consumer.key && consumer.secret}
							<!-- Key -->
							<div>
								<div class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
									Key
								</div>
								<code
									class="block rounded bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
								>
									{consumer.key}
								</code>
							</div>

							<!-- Secret -->
							<div>
								<div class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
									Secret
								</div>
								<code
									class="block rounded bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
								>
									{consumer.secret}
								</code>
							</div>
						{:else}
							<div class="sm:col-span-2">
								<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
									<p class="text-sm text-yellow-800 dark:text-yellow-200">
										<strong>Note:</strong> Consumer credentials (key and secret) are only shown once during creation for security reasons. If you've lost your credentials, you'll need to create a new consumer.
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Additional Details -->
				<div class="mt-4 space-y-2 text-sm">
					{#if consumer.company}
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
							<span class="font-medium text-gray-600 dark:text-gray-400">Company:</span>
							<span class="sm:col-span-2 text-gray-900 dark:text-gray-100">{consumer.company}</span>
						</div>
					{/if}
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
						<span class="font-medium text-gray-600 dark:text-gray-400">Developer Email:</span>
						<span class="sm:col-span-2 text-gray-900 dark:text-gray-100">{consumer.developer_email}</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
						<span class="font-medium text-gray-600 dark:text-gray-400">Redirect URL:</span>
						<span class="sm:col-span-2 text-gray-900 dark:text-gray-100 break-all">
							{consumer.redirect_url || 'Not specified'}
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
		<svg
			class="mx-auto mb-4 h-16 w-16 text-gray-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
			/>
		</svg>
		<p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">No API consumers found</p>
		<p class="mb-4 text-gray-600 dark:text-gray-400">
			You haven't registered any API consumers yet.
		</p>
		<a
			href="/consumers/register"
			class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
		>
			Register Your First Consumer
		</a>
	</div>
{/if}