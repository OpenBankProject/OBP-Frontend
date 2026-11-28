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
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { type SessionData } from 'svelte-kit-sessions';
	import { ConsentCard } from '@obp/shared/components';
	import { toast } from '@obp/shared/utils';
	import { currentBank } from '$lib/stores/currentBank.svelte';
	import { onMount } from 'svelte';

	let bankSelectorId = $state(currentBank.bankId);

	onMount(async () => {
		await currentBank.fetchBanks();
	});

	$effect(() => {
		if (currentBank.banks.length > 0 && bankSelectorId !== currentBank.bankId) {
			currentBank.selectById(bankSelectorId);
		}
	});

	const { data } = $props();
	const userData: SessionData['user'] = data.userData || undefined;

	console.debug('USER DATA:', JSON.stringify(userData));

	const opeyConsentInfo = data.opeyConsentInfo || null;
	const sessionInfo = data.sessionInfo || null;

	function formatTimeRemaining(seconds: number | null): string {
		if (seconds === null) return 'Unknown';
		if (seconds <= 0) return 'Expired';
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m`;
		return `${seconds}s`;
	}

	function tokenStatusColor(seconds: number | null): string {
		if (seconds === null) return 'ui-panel';
		if (seconds <= 0) return 'preset-filled-error-500';
		if (seconds < 300) return 'preset-filled-primary-500';
		return 'preset-filled-primary-500';
	}

	function formatDateFromUnix(epochDateMilliseconds: number | string): string {
		console.log('Formatting date:', epochDateMilliseconds);
		return new Date(epochDateMilliseconds).toLocaleString(undefined, { hourCycle: 'h23' });
	}

	function fromatDateFromISO(isoDateString: string): string {
		return new Date(isoDateString).toLocaleString(undefined, { hourCycle: 'h23' });
	}

	function formatJwtExpiration(epochDateMilliseconds: number | string) {
		const date = new Date(epochDateMilliseconds);
		const now = new Date();
		const isExpired = date < now;
		return {
			formatted: date.toLocaleString(undefined, { hourCycle: 'h23' }),
			isExpired
		};
	}

	function snakeCaseToTitleCase(snakeCase: string): string {
		return snakeCase
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// New function to copy text to clipboard with feedback
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.info('Copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy: ', err);
			toast.error('Failed to copy to clipboard.');
		}
	}

	async function copyJsonToClipboard(jsonData: object) {
		try {
			const jsonString = JSON.stringify(jsonData, null, 2);
			await navigator.clipboard.writeText(jsonString);
			toast.info('User JSON copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy JSON: ', err);
			toast.error('Failed to copy JSON to clipboard.');
		}
	}

	// Track which complex data items are expanded
	let expandedItems = $state([]);

	// Format complex data for display
	function formatValue(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		return JSON.stringify(value, null, 2);
	}

	// Enhanced function to check if an object contains a single array property
	function isSingleArrayContainer(value: any): boolean {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return false;
		}

		const keys = Object.keys(value);
		// Check if it's an object with exactly one property
		if (keys.length !== 1) {
			return false;
		}

		// Check if that one property is an array
		return Array.isArray(value[keys[0]]);
	}

	// Get the array from an object containing a single array property
	function getSingleArray(value: any): any[] {
		if (!isSingleArrayContainer(value)) return [];
		const key = Object.keys(value)[0];
		return value[key];
	}

	// Get a display summary for complex values
	function getComplexValueSummary(value: any): string {
		if (Array.isArray(value)) {
			return `[${value.length} items]`;
		} else if (isSingleArrayContainer(value)) {
			const array = getSingleArray(value);
			return `[${array.length} items]`;
		} else if (value !== null && typeof value === 'object') {
			return `{${Object.keys(value).length} properties}`;
		}
		return String(value);
	}
</script>

{#snippet userInfo(userData: SessionData['user'])}
	{#if userData && Object.keys(userData).length > 0}
		<div class="mx-10 pr-5">
			<header class="flex items-center justify-between py-4">
				<h1 class="h4 text-center align-middle">User Information</h1>
				<button
					class="btn preset-outlined-surface-500 rounded-md p-1 text-sm"
					onclick={() => copyJsonToClipboard(userData)}>Copy JSON</button
				>
			</header>
			<article class="ui-border space-y-3 border-b-[1px] p-4">
				<!-- Group entries by type -->
				{#each Object.entries(userData) as [key, value]}
					{#if Array.isArray(value) || (value !== null && typeof value === 'object')}
						<!-- Complex values use accordion -->
						<Accordion
							value={expandedItems}
							onValueChange={(details: any) => (expandedItems = details.value)}
							multiple
							collapsible
						>
							<Accordion.Item value={key} class="border-0">
								<h4>
									<Accordion.ItemTrigger class="flex w-full items-center justify-between">
										<strong>{snakeCaseToTitleCase(key)}</strong>
										<span class="text-sm ui-link">
											{getComplexValueSummary(value)}
										</span>
									</Accordion.ItemTrigger>
								</h4>

								<Accordion.ItemContent>
									{#if Array.isArray(value)}
										<!-- Array rendering -->
										<div class="space-y-2">
											{#each value as item, i}
												<div class="flex items-start gap-2">
													<span class="w-8 ui-link">{i}:</span>
													{#if item !== null && typeof item === 'object'}
														<div class="flex-1">
															<pre
																class="max-w-full overflow-x-auto rounded p-2 text-sm ui-card">
                                                                {JSON.stringify(item, null, 2)}
                                                            </pre>
															<button
																class="btn btn-sm preset-outlined-surface-500 mt-1"
																onclick={() => copyToClipboard(JSON.stringify(item, null, 2))}
															>
																Copy
															</button>
														</div>
													{:else}
														<div class="flex items-center gap-2">
															<span>{formatValue(item)}</span>
															<button
																class="btn btn-sm preset-tonal"
																onclick={() => copyToClipboard(String(item))}
															>
																Copy
															</button>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{:else if isSingleArrayContainer(value)}
										<!-- Object with single array property -->
										<div class="space-y-2">
											{#each Object.entries(value) as [arrayKey, arrayValue]}
												<div class="flex items-start gap-2">
													<span class="min-w-20 font-semibold ui-link">{arrayKey}:</span>
													{#if Array.isArray(arrayValue)}
														<div class="flex-1 space-y-2">
															{#each arrayValue as item, i}
																<div class="flex items-start gap-2">
																	<span class="w-8 ui-link">{i}:</span>
																	{#if item !== null && typeof item === 'object'}
																		<div class="flex-1">
																			<pre
																				class="max-w-full overflow-x-auto rounded p-2 text-sm ui-card">
                                                                                {JSON.stringify(
																					item,
																					null,
																					2
																				)}
                                                                            </pre>
																			<button
																				class="btn btn-sm preset-outlined-surface-500 mt-1"
																				onclick={() =>
																					copyToClipboard(JSON.stringify(item, null, 2))}
																			>
																				Copy
																			</button>
																		</div>
																	{:else}
																		<div class="flex items-center gap-2">
																			<span>{formatValue(item)}</span>
																			<button
																				class="btn btn-sm preset-tonal"
																				onclick={() => copyToClipboard(String(item))}
																			>
																				Copy
																			</button>
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													{:else}
														<span>{formatValue(arrayValue)}</span>
													{/if}
												</div>
											{/each}
										</div>
									{:else if value !== null && typeof value === 'object'}
										<!-- Regular object rendering -->
										<div class="space-y-2">
											{#each Object.entries(value) as [subKey, subValue]}
												<div class="flex items-start gap-2">
													<span class="min-w-20 font-semibold ui-link">{subKey}:</span>
													{#if subValue !== null && typeof subValue === 'object'}
														<div class="flex-1">
															<pre
																class="max-w-full overflow-x-auto rounded p-2 text-sm ui-card">
                                                                {JSON.stringify(subValue, null, 2)}
                                                            </pre>
															<button
																class="btn btn-sm preset-outlined-surface-500 mt-1"
																onclick={() => copyToClipboard(JSON.stringify(subValue, null, 2))}
															>
																Copy
															</button>
														</div>
													{:else}
														<div class="flex items-center gap-2">
															<span>{formatValue(subValue)}</span>
															<button
																class="btn btn-sm preset-tonal"
																onclick={() => copyToClipboard(String(subValue))}
															>
																Copy
															</button>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</Accordion.ItemContent>
							</Accordion.Item>
						</Accordion>
						<hr class="hr !my-1 opacity-30" />
					{:else}
						<!-- Simple values displayed directly -->
						<div class="ui-hover flex items-center justify-between rounded-md p-2">
							<strong>{snakeCaseToTitleCase(key)}</strong>
							<div class="flex items-center gap-2">
								<span class="rounded-sm p-2 backdrop-blur-2xl ui-card">
									{value}
								</span>
								<button
									class="btn-icon btn-sm preset-tonal"
									onclick={() => copyToClipboard(String(value))}
									title="Copy to clipboard"
									aria-label="Copy to clipboard"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
										<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
									</svg>
								</button>
							</div>
						</div>
						<hr class="hr !my-0 opacity-20" />
					{/if}
				{/each}
			</article>
		</div>
	{:else}
		<div class="mx-10 pr-5">
			<p>No user data available.</p>
		</div>
	{/if}
{/snippet}

<div class="flex flex-col space-y-6">
	<!-- Current Bank Selection -->
	<div class="mx-10 pr-5">
		<header class="flex items-center justify-between py-4">
			<h1 class="h4 text-center align-middle">Current Bank</h1>
		</header>
		<div class="max-w-md">
			<select
				class="w-full rounded-lg border px-3 py-2 text-sm ui-card ui-text ui-border"
				bind:value={bankSelectorId}
			>
				<option value="">No bank selected</option>
				{#each currentBank.banks as bank}
					<option value={bank.bank_id}>
						{bank.short_name} - {bank.full_name}
					</option>
				{/each}
			</select>
		</div>
	</div>

	{@render userInfo(userData)}

	<div class="mx-10 pr-5">
		<header class="py-4">
			<h1 class="h4 text-center align-middle">Session Info</h1>
		</header>
		{#if sessionInfo && sessionInfo.hasAccessToken}
			<article class="ui-border space-y-1 border-b-[1px] p-4">
				{#each [
					{ label: 'Session ID', value: sessionInfo.sessionId },
					{ label: 'OAuth Provider', value: sessionInfo.oauthProvider },
				] as item}
					<div class="ui-hover flex items-center justify-between rounded-md p-2" data-testid={`session-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
						<strong>{item.label}</strong>
						<span class="rounded-sm p-2 font-mono text-sm backdrop-blur-2xl ui-card">
							{item.value || 'N/A'}
						</span>
					</div>
					<hr class="hr !my-0 opacity-20" />
				{/each}

				<!-- Access Token -->
				<div class="ui-hover flex items-center justify-between rounded-md p-2" data-testid="session-access-token">
					<div class="flex items-center gap-2">
						<strong>Access Token</strong>
						<span class="h-2.5 w-2.5 rounded-full {tokenStatusColor(sessionInfo.accessTokenExpiresInSeconds)}" title={sessionInfo.accessTokenExpiresInSeconds !== null && sessionInfo.accessTokenExpiresInSeconds <= 0 ? 'Expired' : 'Active'}></span>
					</div>
					<div class="flex items-center gap-3">
						<span class="rounded-sm p-2 font-mono text-sm backdrop-blur-2xl ui-card">
							{sessionInfo.accessTokenPreview || 'N/A'}
						</span>
						<span class="text-xs ui-muted">
							{#if sessionInfo.accessTokenExpiresInSeconds !== null && sessionInfo.accessTokenExpiresInSeconds <= 0}
								Expired
							{:else}
								{formatTimeRemaining(sessionInfo.accessTokenExpiresInSeconds)} remaining
							{/if}
						</span>
					</div>
				</div>
				<hr class="hr !my-0 opacity-20" />

				<!-- Refresh Token -->
				<div class="ui-hover flex items-center justify-between rounded-md p-2" data-testid="session-refresh-token">
					<div class="flex items-center gap-2">
						<strong>Refresh Token</strong>
						{#if sessionInfo.hasRefreshToken}
							<span class="h-2.5 w-2.5 rounded-full {tokenStatusColor(sessionInfo.refreshTokenExpiresInSeconds)}" title={sessionInfo.refreshTokenExpiresInSeconds !== null && sessionInfo.refreshTokenExpiresInSeconds <= 0 ? 'Expired' : 'Active'}></span>
						{:else}
							<span class="h-2.5 w-2.5 rounded-full preset-filled-error-500" title="Missing"></span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if sessionInfo.hasRefreshToken}
							<span class="rounded-sm p-2 font-mono text-sm backdrop-blur-2xl ui-card">
								{sessionInfo.refreshTokenPreview}
							</span>
							<span class="text-xs ui-muted">
								{#if sessionInfo.refreshTokenExpiresAt === null}
									Expiry unknown (not a JWT)
								{:else if sessionInfo.refreshTokenExpiresInSeconds !== null && sessionInfo.refreshTokenExpiresInSeconds <= 0}
									Expired
								{:else}
									{formatTimeRemaining(sessionInfo.refreshTokenExpiresInSeconds)} remaining
								{/if}
							</span>
						{:else}
							<span class="text-xs ui-text-error">
								None — session cannot auto-renew
							</span>
						{/if}
					</div>
				</div>
				<hr class="hr !my-0 opacity-20" />
			</article>
		{:else}
			<article class="ui-border border-b-[1px] p-4">
				<div class="rounded-lg p-3 ui-tone-warning" data-testid="session-warning">
					<p class="text-sm ui-text-warning">
						No active session found. Your session may have expired.
						<a href="/login" class="font-medium underline ui-text-warning">Log in again</a> to restore full functionality.
					</p>
				</div>
			</article>
		{/if}
	</div>

	{#if opeyConsentInfo && opeyConsentInfo.hasActiveConsent && opeyConsentInfo.consent}
		<header class="py-4" id="opey-consent">
			<h1 class="h4 text-center">Consent for Opey</h1>
		</header>
		<div class="mx-auto w-4/6">
			<ConsentCard consent={opeyConsentInfo.consent} showDeleteButton={false} />
		</div>
	{/if}
	<!-- <div
		class="card ui-panel ui-border mx-auto my-10 flex max-w-md flex-col divide-y border-[1px] shadow-lg sm:max-w-2xl lg:max-w-3xl"
	>
		<header class="py-4">
			<h1 class="h4 text-center">Consent for Opey</h1>
		</header>
		<article class="space-y-4 p-4">
			{#if opeyConsentInfo}
				<div class="ui-card m-1.5 rounded-lg p-4 shadow-md">
					{#if opeyConsentInfo.hasActiveConsent}
						<div class="mb-4 flex items-center gap-2">
							<div class="h-3 w-3 rounded-full preset-filled-primary-500"></div>
							<span class="font-semibold ui-text">Active Consent</span>
						</div>
						<ul class="list-inside space-y-2 ui-text">
							<li>
								<strong class="ui-link">Consent ID:</strong>
								{opeyConsentInfo.consent_id}
							</li>
							<li>
								<strong class="ui-link">Status:</strong>
								{opeyConsentInfo.status}
							</li>
							<li>
								<strong class="ui-link">Consumer ID:</strong>
								{opeyConsentInfo.consumer_id}
							</li>
							<li>
								<strong class="ui-link">Created At:</strong>
								{opeyConsentInfo.jwt_payload?.iat ? formatDateFromUnix(opeyConsentInfo.jwt_payload?.iat * 1000) : 'Not available'}
							</li>
							{#if opeyConsentInfo.last_usage_date}
								<li>
									<strong class="ui-link">Last Usage Date:</strong>
									{fromatDateFromISO(opeyConsentInfo.last_usage_date)}
								</li>
							{/if}
							{#if opeyConsentInfo.jwt_expires_at}
								{@const jwtExp = formatJwtExpiration(new Date(opeyConsentInfo.jwt_expires_at).getTime())}
								<li>
									<strong class="ui-link">JWT Expires:</strong>
									{jwtExp.formatted}
									{jwtExp.isExpired ? '(Expired)' : ''}
								</li>
							{/if}
						</ul>
						<div class="mt-4 rounded-lg p-3 ui-tone-info">
							<p class="text-sm ui-muted">
								<strong>Info:</strong> This consent allows Opey to access your Open Bank Project data
								on your behalf. The JWT token is used for secure communication between the portal and
								Opey services.
							</p>
						</div>
						<div class="mt-4">
							<a
								href="/user/consents"
								class="text-sm font-medium underline ui-link"
							>
								All My Consents
							</a>
						</div>
					{:else}
						<div class="mb-4 flex items-center gap-2">
							<div class="h-3 w-3 rounded-full preset-filled-primary-500"></div>
							<span class="font-semibold ui-text">No Active Consent</span>
						</div>
						{#if opeyConsentInfo.error}
							<div class="rounded-lg p-3 ui-tone-info">
								<p class="ui-muted">
									<strong>Error:</strong>
									{opeyConsentInfo.error}
								</p>
							</div>
						{:else}
							<div class="rounded-lg p-3 ui-tone-info">
								<p class="ui-muted">
									{opeyConsentInfo.message}
								</p>
							</div>
						{/if}
						<div class="mt-4">
							<a
								href="/user/consents"
								class="text-sm font-medium underline ui-link"
							>
								All My Consents
							</a>
						</div>
					{/if}
				</div>
			{:else}
				<div class="ui-card m-1.5 rounded-lg p-4 shadow-md">
					<p class="text-center ui-muted">Opey integration not configured.</p>
					<div class="mt-4 text-center">
						<a href="/user/consents" class="text-sm font-medium underline ui-link">
							All My Consents
						</a>
					</div>
				</div>
			{/if}
		</article>
	</div> -->
</div>
