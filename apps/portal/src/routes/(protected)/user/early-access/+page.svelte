<script lang="ts">
	import { earlyAccessItems } from '$lib/config/navigation';
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Early Access</h1>
	<p class="mb-6 text-gray-700 dark:text-gray-300">
		These pages are in early access. Some require specific query parameters to function fully,
		but you can visit them to see their current state.
	</p>

	<div class="space-y-3">
		{#each earlyAccessItems as item}
			{@const Icon = item.iconComponent}
			<a
				href={item.href}
				class="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600 dark:hover:bg-gray-700"
			>
				<Icon class="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
				<div>
					<span class="font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
					{#if item.description}
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>
