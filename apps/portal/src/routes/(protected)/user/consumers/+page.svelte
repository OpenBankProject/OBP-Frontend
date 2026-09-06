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

<p class="mb-6 text-sm text-gray-700 dark:text-gray-300">
	Keys and secrets are shown only at creation. If lost, <a href="/consumers/register" class="underline hover:text-gray-900 dark:hover:text-gray-100">register a new consumer</a>.
</p>

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
							{#if consumer.redirect_url}
								<a
									href={consumer.redirect_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
									data-testid="consumer-redirect-url"
								>
									{consumer.redirect_url}
								</a>
							{:else}
								Not specified
							{/if}
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