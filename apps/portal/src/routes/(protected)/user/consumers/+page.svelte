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
	import { isSafeLinkUrl, redirectUrlEntries } from '@obp/shared/utils';

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
				hourCycle: 'h23',
				minute: '2-digit'
			});
		} catch {
			return 'Unknown date';
		}
	}
</script>

<p class="mb-6 text-sm ui-muted">
	Keys and secrets are shown only at creation. If lost, <a href="/consumers/register" class="underline">register a new consumer</a>.
</p>

{#if consumers && consumers.length > 0}
	<div class="space-y-4">
		{#each consumers as consumer (consumer.consumer_id)}
			<div class="rounded-lg border p-6 shadow-sm ui-card ui-border">
				<!-- Header with App Name and Status -->
				<div class="mb-4 flex items-start justify-between">
					<div>
						<h2 class="text-xl font-semibold ui-text">
							{consumer.app_name}
						</h2>
						<p class="mt-1 text-sm ui-muted">
							Created: {formatDate(consumer.created)}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-full px-3 py-1 text-xs font-medium {consumer.enabled
								? 'ui-tone-success'
								: 'ui-tone-error'}"
						>
							{consumer.enabled ? 'Enabled' : 'Disabled'}
						</span>
						<span
							class="rounded-full px-3 py-1 text-xs font-medium ui-tone-info"
						>
							{consumer.app_type}
						</span>
					</div>
				</div>

				{#if !consumer.enabled}
					<div
						class="mb-4 rounded-lg p-3 ui-tone-warning"
						role="alert"
						data-testid="consumer-disabled-warning-{consumer.consumer_id}"
					>
						<p class="text-sm ui-text-warning">
							This Consumer is disabled. Its key and secret will not work until an administrator enables it.
							Ask an administrator of this API to enable Consumer ID <code>{consumer.consumer_id}</code>.
						</p>
					</div>
				{/if}

				<!-- Description -->
				{#if consumer.description}
					<p class="mb-4 text-sm ui-muted">
						{consumer.description}
					</p>
				{/if}

				<!-- Credentials Section -->
				<div class="space-y-3 rounded-lg p-4 ui-card">
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Consumer ID -->
						<div class="sm:col-span-2">
							<div class="mb-1 block text-xs font-medium ui-muted">
								Consumer ID
							</div>
							<code
								class="block rounded px-3 py-2 text-sm ui-card ui-text"
							>
								{consumer.consumer_id}
							</code>
						</div>

						{#if consumer.key && consumer.secret}
							<!-- Key -->
							<div>
								<div class="mb-1 block text-xs font-medium ui-muted">
									Key
								</div>
								<code
									class="block rounded px-3 py-2 text-sm ui-card ui-text"
								>
									{consumer.key}
								</code>
							</div>

							<!-- Secret -->
							<div>
								<div class="mb-1 block text-xs font-medium ui-muted">
									Secret
								</div>
								<code
									class="block rounded px-3 py-2 text-sm ui-card ui-text"
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
							<span class="font-medium ui-muted">Company:</span>
							<span class="sm:col-span-2 ui-text">{consumer.company}</span>
						</div>
					{/if}
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
						<span class="font-medium ui-muted">Developer Email:</span>
						<span class="sm:col-span-2 ui-text">{consumer.developer_email}</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
						<span class="font-medium ui-muted">Redirect URL:</span>
						<span class="sm:col-span-2 break-all ui-text">
							{#if consumer.redirect_url}
								<!-- Each entry on its own; only an http or https entry becomes a link, so a stored
								     javascript: value is shown as text and can never run when clicked. -->
								{#each redirectUrlEntries(consumer.redirect_url) as entry}
									{#if isSafeLinkUrl(entry)}
										<a
											href={entry}
											target="_blank"
											rel="noopener noreferrer"
											class="mr-2 underline ui-link"
											data-testid="consumer-redirect-url"
										>
											{entry}
										</a>
									{:else}
										<span class="mr-2" data-testid="consumer-redirect-url-text">{entry}</span>
									{/if}
								{/each}
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
	<div class="rounded-lg p-8 text-center ui-panel">
		<svg
			class="mx-auto mb-4 h-16 w-16 ui-muted"
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
		<p class="mb-2 text-lg font-medium ui-muted">No API consumers found</p>
		<p class="mb-4 ui-muted">
			You haven't registered any API consumers yet.
		</p>
		<a
			href="/consumers/register"
			class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 preset-filled-primary-500"
		>
			Register Your First Consumer
		</a>
	</div>
{/if}