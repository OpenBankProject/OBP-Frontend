<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	
	let { data }: { data: PageData } = $props();
	
	let autoRefresh = $state(true);
	let refreshInterval = $state(30); // seconds
	let countdown = $state(refreshInterval);
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let countdownId: ReturnType<typeof setInterval> | null = null;
	
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
			const response = await fetch('/api/status');
			const newData = await response.json();
			data = newData;
			countdown = refreshInterval;
		} catch (error) {
			console.error('Failed to refresh status:', error);
		}
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
				<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
					<div class="text-2xl font-bold text-red-600 dark:text-red-400">{data.summary.unhealthy}</div>
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
							<h3 class="text-xl font-semibold mb-1">{service.service}</h3>
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
	</div>
</div>

<style>
	/* Add any custom styles here if needed */
</style>
