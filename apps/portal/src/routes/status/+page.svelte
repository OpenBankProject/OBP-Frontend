<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { Copy, Check } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';

	let { data }: { data: PageData } = $props();

	let autoRefresh = $state(true);
	let refreshInterval = $state(30); // seconds
	let countdown = $state(refreshInterval);
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let countdownId: ReturnType<typeof setInterval> | null = null;
	let copiedService = $state<string | null>(null);

	// Browser-side Opey check: fetches PUBLIC_OPEY_BASE_URL/status from the user's
	// network, mirroring the path the Opey chat actually uses. Different from the
	// 'Opey II (server)' check which runs on the portal server.
	type BrowserCheck = {
		status: 'healthy' | 'unhealthy' | 'unknown';
		responseTimeMs?: number;
		error?: string;
		lastChecked?: string;
		details: Record<string, string>;
	};
	let opeyBrowserCheck = $state<BrowserCheck>({
		status: 'unknown',
		details: { PUBLIC_OPEY_BASE_URL: env.PUBLIC_OPEY_BASE_URL || '(unset)' }
	});

	async function runOpeyBrowserCheck() {
		const url = env.PUBLIC_OPEY_BASE_URL;
		const lastChecked = new Date().toISOString();
		if (!url) {
			opeyBrowserCheck = {
				status: 'unhealthy',
				error: 'PUBLIC_OPEY_BASE_URL is not set in the browser env',
				lastChecked,
				details: { PUBLIC_OPEY_BASE_URL: '(unset)' }
			};
			return;
		}
		const start = performance.now();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort('timeout'), 5000);
		try {
			const res = await fetch(`${url}/status`, { signal: controller.signal });
			const responseTimeMs = Math.round(performance.now() - start);
			if (res.ok) {
				opeyBrowserCheck = {
					status: 'healthy',
					responseTimeMs,
					lastChecked,
					details: { PUBLIC_OPEY_BASE_URL: url }
				};
			} else {
				opeyBrowserCheck = {
					status: 'unhealthy',
					responseTimeMs,
					error: `Unexpected status code: ${res.status}`,
					lastChecked,
					details: { PUBLIC_OPEY_BASE_URL: url }
				};
			}
		} catch (err) {
			const responseTimeMs = Math.round(performance.now() - start);
			const msg = err instanceof Error ? err.message : String(err);
			opeyBrowserCheck = {
				status: 'unhealthy',
				responseTimeMs,
				error: msg === 'timeout' ? 'Request timeout' : msg,
				lastChecked,
				details: { PUBLIC_OPEY_BASE_URL: url }
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	function buildServiceText(name: string, service: typeof data.services[string]): string {
		const lines = [
			`Service: ${service.service}`,
			`Status: ${service.status}`,
			`Last Checked: ${service.lastChecked}`
		];
		if (service.responseTimeMs !== undefined) {
			lines.push(`Response Time: ${service.responseTimeMs}ms`);
		}
		if (service.conecutiveFailures > 0) {
			lines.push(`Consecutive Failures: ${service.conecutiveFailures}`);
		}
		if (service.details) {
			for (const [key, value] of Object.entries(service.details)) {
				lines.push(`${key}: ${value}`);
			}
		}
		if (service.error) {
			lines.push(`Error: ${service.error}`);
		}
		return lines.join('\n');
	}

	async function copyServiceDetails(name: string, service: typeof data.services[string]) {
		const text = buildServiceText(name, service);
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
		copiedService = name;
		setTimeout(() => {
			if (copiedService === name) copiedService = null;
		}, 2000);
	}
	
	function getStatusColor(status: string): string {
		switch (status) {
			case 'healthy':
				return 'bg-green-500';
			case 'unhealthy':
				return 'bg-red-500';
			case 'degraded':
				return 'bg-yellow-500';
			case 'unknown':
			default:
				return 'bg-gray-500';
		}
	}
	
	function getStatusTextColor(status: string): string {
		switch (status) {
			case 'healthy':
				return 'text-green-600 dark:text-green-400';
			case 'unhealthy':
				return 'text-red-600 dark:text-red-400';
			case 'degraded':
				return 'text-yellow-600 dark:text-yellow-400';
			case 'unknown':
			default:
				return 'text-gray-600 dark:text-gray-400';
		}
	}
	
	function getStatusIcon(status: string): string {
		switch (status) {
			case 'healthy':
				return '✓';
			case 'unhealthy':
				return '✗';
			case 'degraded':
				return '⚠';
			case 'unknown':
			default:
				return '?';
		}
	}
	
	function formatTimestamp(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleString();
	}
	
	function formatResponseTime(ms?: number): string {
		if (ms === undefined) return 'N/A';
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
	
	async function refreshData() {
		try {
			const response = await fetch('/backend/status');
			const newData = await response.json();
			data = newData;
			countdown = refreshInterval;
		} catch (error) {
			console.error('Failed to refresh status:', error);
		}
		await runOpeyBrowserCheck();
	}
	
	function startAutoRefresh() {
		if (intervalId) return;
		
		intervalId = setInterval(() => {
			refreshData();
		}, refreshInterval * 1000);
		
		countdownId = setInterval(() => {
			countdown = countdown > 0 ? countdown - 1 : refreshInterval;
		}, 1000);
	}
	
	function stopAutoRefresh() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		if (countdownId) {
			clearInterval(countdownId);
			countdownId = null;
		}
	}
	
	$effect(() => {
		if (autoRefresh) {
			countdown = refreshInterval;
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
		
		return () => {
			stopAutoRefresh();
		};
	});
	
	onMount(() => {
		runOpeyBrowserCheck();
	});

	onDestroy(() => {
		stopAutoRefresh();
	});
</script>

<svelte:head>
	<title>System Status - OBP Portal</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-5xl">
	<div class="mb-8">
		<h1 class="text-4xl font-bold mb-2 h1">System Status</h1>
		<p class="text-gray-600 dark:text-gray-400">
			Real-time health monitoring of all services
		</p>
	</div>

	<!-- Overall Status Card -->
	<div class="bg-primary-500/50 backdrop-blur-2xl mx-auto rounded-lg shadow-lg p-6 mb-8">
		<div class="flex items-center justify-between mb-4">
			<div>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Last updated: {formatTimestamp(data.timestamp)}
				</p>
			</div>
			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={autoRefresh} class="rounded" />
					Auto-refresh ({countdown}s)
				</label>
				<button
					onclick={refreshData}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
				>
					Refresh Now
				</button>
			</div>
		</div>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="flex items-center gap-4">
				<div class="w-20 h-20 rounded-full {getStatusColor(data.overallStatus)} flex items-center justify-center text-white text-3xl font-bold">
					{getStatusIcon(data.overallStatus)}
				</div>
				<div>
					<div class="text-3xl font-bold {getStatusTextColor(data.overallStatus)} capitalize">
						{data.overallStatus}
					</div>
					<div class="text-lg text-gray-600 dark:text-gray-400">
						{data.healthPercentage}% Operational
					</div>
				</div>
			</div>
			
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
					<div class="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.total}</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Total Services</div>
				</div>
				<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
					<div class="text-2xl font-bold text-green-600 dark:text-green-400">{data.summary.healthy}</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Healthy</div>
				</div>
				<div class="{data.summary.unhealthy > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'} rounded-lg p-4">
					<div class="text-2xl font-bold {data.summary.unhealthy > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">{data.summary.unhealthy}</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Unhealthy</div>
				</div>
				<div class="bg-gray-100 dark:bg-gray-600 rounded-lg p-4">
					<div class="text-2xl font-bold text-gray-600 dark:text-gray-400">{data.summary.unknown}</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Unknown</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Services List -->
	<div class="space-y-4">
		<h2 class="text-2xl font-bold mb-4">Service Details</h2>
		
		{#each Object.entries(data.services) as [serviceName, service]}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-4 flex-1">
						<div class="w-12 h-12 rounded-full {getStatusColor(service.status)} flex items-center justify-center text-white text-xl font-bold">
							{getStatusIcon(service.status)}
						</div>
						<div class="flex-1">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-xl font-semibold mb-1">{service.service}</h3>
								<button
									type="button"
									onclick={() => copyServiceDetails(serviceName, service)}
									class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
									aria-label="Copy {service.service} details"
									title="Copy details"
									data-testid="copy-service-{serviceName}"
								>
									{#if copiedService === serviceName}
										<Check class="h-4 w-4 text-green-600 dark:text-green-400" />
									{:else}
										<Copy class="h-4 w-4" />
									{/if}
								</button>
							</div>
							<div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
								<span class="flex items-center gap-1">
									<span class="font-medium">Status:</span>
									<span class="{getStatusTextColor(service.status)} font-semibold capitalize">
										{service.status}
									</span>
								</span>
								{#if service.responseTimeMs !== undefined}
									<span class="flex items-center gap-1">
										<span class="font-medium">Response Time:</span>
										<span class={service.responseTimeMs > 5000 ? 'text-red-600 dark:text-red-400' : service.responseTimeMs > 1000 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
											{formatResponseTime(service.responseTimeMs)}
										</span>
									</span>
								{/if}
								<span class="flex items-center gap-1">
									<span class="font-medium">Last Checked:</span>
									<span>{formatTimestamp(service.lastChecked)}</span>
								</span>
								{#if service.conecutiveFailures > 0}
									<span class="flex items-center gap-1 text-red-600 dark:text-red-400">
										<span class="font-medium">Consecutive Failures:</span>
										<span class="font-bold">{service.conecutiveFailures}</span>
									</span>
								{/if}
							</div>
							{#if service.details && Object.keys(service.details).length > 0}
								<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400" data-testid="service-details-{serviceName}">
									{#each Object.entries(service.details) as [key, value]}
										<dt class="font-medium">{key}:</dt>
										<dd class="font-mono break-all">{value}</dd>
									{/each}
								</dl>
							{/if}
							{#if service.error}
								<div class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
									<p class="text-sm text-red-700 dark:text-red-300 font-mono">
										<span class="font-semibold">Error:</span> {service.error}
									</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/each}
		
		{#if Object.keys(data.services).length === 0}
			<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
				<p class="text-gray-600 dark:text-gray-400">No services are being monitored.</p>
			</div>
		{/if}

		<!-- Browser-side Opey check: runs in the user's browser, not the portal server -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow" data-testid="service-opey-browser">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-4 flex-1">
					<div class="w-12 h-12 rounded-full {getStatusColor(opeyBrowserCheck.status)} flex items-center justify-center text-white text-xl font-bold">
						{getStatusIcon(opeyBrowserCheck.status)}
					</div>
					<div class="flex-1">
						<h3 class="text-xl font-semibold mb-1">Opey II (browser)</h3>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
							Fetched directly from your browser to PUBLIC_OPEY_BASE_URL — mirrors the path the Opey chat uses.
						</p>
						<div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
							<span class="flex items-center gap-1">
								<span class="font-medium">Status:</span>
								<span class="{getStatusTextColor(opeyBrowserCheck.status)} font-semibold capitalize">
									{opeyBrowserCheck.status}
								</span>
							</span>
							{#if opeyBrowserCheck.responseTimeMs !== undefined}
								<span class="flex items-center gap-1">
									<span class="font-medium">Response Time:</span>
									<span class={opeyBrowserCheck.responseTimeMs > 5000 ? 'text-red-600 dark:text-red-400' : opeyBrowserCheck.responseTimeMs > 1000 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
										{formatResponseTime(opeyBrowserCheck.responseTimeMs)}
									</span>
								</span>
							{/if}
							{#if opeyBrowserCheck.lastChecked}
								<span class="flex items-center gap-1">
									<span class="font-medium">Last Checked:</span>
									<span>{formatTimestamp(opeyBrowserCheck.lastChecked)}</span>
								</span>
							{/if}
						</div>
						<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400" data-testid="service-details-opey-browser">
							{#each Object.entries(opeyBrowserCheck.details) as [key, value]}
								<dt class="font-medium">{key}:</dt>
								<dd class="font-mono break-all">{value}</dd>
							{/each}
						</dl>
						{#if opeyBrowserCheck.error}
							<div class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
								<p class="text-sm text-red-700 dark:text-red-300 font-mono">
									<span class="font-semibold">Error:</span> {opeyBrowserCheck.error}
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Add any custom styles here if needed */
</style>
