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
	import { Copy, Check } from '@lucide/svelte';
	import { markdownToHtml } from '$lib/markdown/featuredMarkdown';

	let { data } = $props();

	// Target characters for description preview, with flexible buffer to find sentence boundary
	const DESCRIPTION_CUTOFF_LENGTH = 500;
	const DESCRIPTION_CUTOFF_BUFFER = 200; // Extra chars to search for sentence boundary

	// Stop phrases that indicate technical content - truncate before these
	const STOP_PHRASES = [
		'URL Parameters:',
		'User Authentication is Optional. The User need not be logged in.',
		'JSON response body fields:',
		'User Authentication is Required.',
		'This is a management endpoint that requires the',
		'Authentication is required if the view',
		'Authentication is required as the tag',
		'Examples:',
	];

	// Calculate effective display length (after processing)
	function getEffectiveLength(markdown: string | undefined, summary?: string): number {
		if (!markdown) return 0;
		let text = markdown;

		// Remove summary if present (same logic as getDescriptionPreview)
		if (summary) {
			const cleanSummary = summary.trim();
			const headingPattern = new RegExp(`^#+\\s*${cleanSummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n*`, 'i');
			text = text.replace(headingPattern, '').trim();
			if (text.startsWith(cleanSummary)) {
				text = text.substring(cleanSummary.length).trim();
			}
		}

		// Find earliest stop phrase
		let cutoffIndex = text.length;
		for (const phrase of STOP_PHRASES) {
			const index = text.indexOf(phrase);
			if (index !== -1 && index < cutoffIndex) {
				cutoffIndex = index;
			}
		}

		// Use extended limit for finding sentence boundary
		const extendedLimit = DESCRIPTION_CUTOFF_LENGTH + DESCRIPTION_CUTOFF_BUFFER;
		return Math.min(cutoffIndex, extendedLimit);
	}

	// Sort endpoints by effective display length (ascending) so shorter cards appear at top
	let sortedEndpoints = $derived(
		[...(data.endpoints || [])].sort((a, b) => {
			const lenA = getEffectiveLength(a.description_markdown, a.summary);
			const lenB = getEffectiveLength(b.description_markdown, b.summary);
			return lenA - lenB;
		})
	);

	// Track which operation IDs have been copied (for feedback)
	let copiedIds = $state(new Set<string>());

	// Get truncated markdown (for copying) - similar logic to getDescriptionPreview but returns markdown
	function getMarkdownPreview(markdown: string, maxLength: number = DESCRIPTION_CUTOFF_LENGTH, summary?: string): string {
		let text = markdown;

		// If description starts with the summary, skip it
		if (summary) {
			const cleanSummary = summary.trim();
			const headingPattern = new RegExp(`^#+\\s*${cleanSummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n*`, 'i');
			text = text.replace(headingPattern, '').trim();
			if (text.startsWith(cleanSummary)) {
				text = text.substring(cleanSummary.length).trim();
			}
		}

		// Find the earliest stop phrase
		let cutoffIndex = text.length;
		for (const phrase of STOP_PHRASES) {
			const index = text.indexOf(phrase);
			if (index !== -1 && index < cutoffIndex) {
				cutoffIndex = index;
			}
		}

		if (cutoffIndex < text.length) {
			text = text.substring(0, cutoffIndex).trim();
		}

		return text;
	}

	function buildCardText(endpoint: typeof data.endpoints[0]): string {
		const lines: string[] = [];

		// Title
		lines.push(`## ${endpoint.summary || endpoint.operation_id}`);
		lines.push('');

		// Description
		if (endpoint.description_markdown) {
			const preview = getMarkdownPreview(endpoint.description_markdown, 2000, endpoint.summary);
			lines.push(preview);
			lines.push('');
		}

		// Verb and Path
		if (endpoint.request_verb && endpoint.request_url) {
			lines.push(`${endpoint.request_verb} ${endpoint.request_url}`);
			lines.push('');
		}

		// Tags
		if (endpoint.tags && endpoint.tags.length > 0) {
			lines.push(`Tags: ${endpoint.tags.join(', ')}`);
			lines.push('');
		}

		// Operation ID and links
		lines.push(`Operation ID: ${endpoint.operation_id}`);
		lines.push(`Tell Me More: ${window.location.origin}${buildTellMeMoreUrl(endpoint.operation_id)}`);
		lines.push(`Explore: ${buildApiExplorerUrl(endpoint.operation_id)}`);

		return lines.join('\n');
	}

	async function copyCard(endpoint: typeof data.endpoints[0]) {
		const text = buildCardText(endpoint);
		try {
			await navigator.clipboard.writeText(text);
			copiedIds.add(endpoint.operation_id);
			copiedIds = new Set(copiedIds);
			// Reset after 2 seconds
			setTimeout(() => {
				copiedIds.delete(endpoint.operation_id);
				copiedIds = new Set(copiedIds);
			}, 2000);
		} catch (err) {
			// Fallback for older browsers or non-HTTPS contexts
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copiedIds.add(endpoint.operation_id);
			copiedIds = new Set(copiedIds);
			setTimeout(() => {
				copiedIds.delete(endpoint.operation_id);
				copiedIds = new Set(copiedIds);
			}, 2000);
		}
	}

	function getMethodColor(method: string): string {
		switch (method.toUpperCase()) {
			case 'GET':
				return 'ui-tone-success';
			case 'POST':
				return 'ui-tone-info';
			case 'PUT':
				return 'ui-tone-warning';
			case 'DELETE':
				return 'ui-tone-error';
			case 'PATCH':
				return 'ui-tone-accent';
			default:
				return 'ui-panel ui-muted';
		}
	}

	function buildApiExplorerUrl(operationId: string): string {
		if (!data.apiExplorerUrl) return '#';
		// Extract version from operationId (e.g., "OBPv6.0.0-getAbacRule" -> "OBPv6.0.0")
		const hyphenIndex = operationId.indexOf('-');
		const version = hyphenIndex > 0 ? operationId.substring(0, hyphenIndex) : operationId;
		// Build URL: /resource-docs/{VERSION}?operationid={operationId}
		const baseUrl = data.apiExplorerUrl.replace(/\/$/, ''); // Remove trailing slash if present
		return `${baseUrl}/resource-docs/${version}?operationid=${operationId}`;
	}

	function buildTellMeMoreUrl(operationId: string): string {
		const question = `Tell me more about the API endpoint with operation ID: ${operationId}`;
		return `/?ask=${encodeURIComponent(question)}`;
	}

	// Get description preview as HTML, stopping at technical phrases
	function getDescriptionPreview(markdown: string, maxLength: number = DESCRIPTION_CUTOFF_LENGTH, summary?: string): string {
		let text = markdown;

		// If description starts with the summary (as heading or plain text), skip it
		if (summary) {
			const cleanSummary = summary.trim();
			// Check for markdown heading format
			const headingPattern = new RegExp(`^#+\\s*${cleanSummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n*`, 'i');
			text = text.replace(headingPattern, '').trim();
			// Also check plain text start
			if (text.startsWith(cleanSummary)) {
				text = text.substring(cleanSummary.length).trim();
			}
		}

		// Find the earliest stop phrase
		let cutoffIndex = text.length;
		let stoppedByPhrase = false;
		for (const phrase of STOP_PHRASES) {
			const index = text.indexOf(phrase);
			if (index !== -1 && index < cutoffIndex) {
				cutoffIndex = index;
				stoppedByPhrase = true;
			}
		}

		// If text is short enough and no stop phrase, return as-is
		if (text.length <= maxLength && cutoffIndex === text.length) {
			return markdownToHtml(text);
		}

		// Common abbreviations that shouldn't be treated as sentence ends
		const abbreviations = ['i.e.', 'e.g.', 'etc.', 'vs.', 'Mr.', 'Mrs.', 'Dr.', 'Jr.', 'Sr.', 'Inc.', 'Ltd.', 'Corp.'];

		// Helper function to find sentence boundary in a region
		function findSentenceBoundary(region: string, searchBackwards: boolean = true): number {
			if (searchBackwards) {
				for (let i = region.length - 1; i >= 0; i--) {
					const char = region[i];
					if (char === '.' || char === '!' || char === '?') {
						const isEndOfRegion = i === region.length - 1;
						const nextChar = !isEndOfRegion ? region[i + 1] : '';
						const charAfterSpace = (i + 2 < region.length) ? region[i + 2] : '';

						// Must be followed by newline, or space and uppercase letter
						const looksLikeSentenceEnd = isEndOfRegion ||
							nextChar === '\n' ||
							(nextChar === ' ' && charAfterSpace && charAfterSpace.match(/[A-Z]/));

						if (looksLikeSentenceEnd) {
							const precedingText = region.substring(Math.max(0, i - 5), i + 1).toLowerCase();
							const isAbbreviation = abbreviations.some(abbr => precedingText.endsWith(abbr.toLowerCase()));

							if (!isAbbreviation) {
								return i + 1;
							}
						}
					}
				}
			}
			return -1;
		}

		// Determine the maximum we're willing to show (stop phrase or extended limit)
		const extendedLimit = maxLength + DESCRIPTION_CUTOFF_BUFFER;
		const hardLimit = stoppedByPhrase ? cutoffIndex : Math.min(text.length, extendedLimit);

		// Search for sentence boundary within the extended region
		const searchRegion = text.substring(0, hardLimit);
		let sentenceEnd = findSentenceBoundary(searchRegion);

		// If found and it's reasonable (> 50 chars), use it
		if (sentenceEnd > 50) {
			return markdownToHtml(text.substring(0, sentenceEnd).trim());
		}

		// No good sentence boundary found - use stop phrase position or hard limit
		const result = text.substring(0, stoppedByPhrase ? cutoffIndex : hardLimit).trim();
		return markdownToHtml(result);
	}

</script>

<svelte:head>
	<title>Featured API Endpoints</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<h1 class="mb-2 text-3xl font-bold ui-text">Featured API Endpoints</h1>
	<p class="mb-8 ui-muted">
		This page shows featured APIs collections and frequently used endpoints.
	</p>

	{#if data.notConfigured}
		<p class="mt-6 text-center text-sm ui-muted" data-testid="featured-not-configured">Not configured.</p>
	{:else if data.message && data.endpoints?.length === 0}
		<div class="rounded-lg border p-4 text-center ui-tone-error">
			<p class="ui-text-error">{data.message}</p>
		</div>
	{:else if data.endpoints && data.endpoints.length > 0}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each sortedEndpoints as endpoint (endpoint.operation_id)}
				{@const hasEnrichedData = !!endpoint.summary}
				<div class="flex flex-col rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md ui-card ui-border">
					<!-- Title -->
					<h3 class="text-base font-semibold ui-text">
						{endpoint.summary || endpoint.operation_id}
					</h3>

					<!-- Description -->
					{#if endpoint.description_markdown}
						<div class="mt-2 flex-grow text-sm prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words ui-muted">
							{@html getDescriptionPreview(endpoint.description_markdown, DESCRIPTION_CUTOFF_LENGTH, endpoint.summary)}
						</div>
					{/if}

					<!-- Verb and Path (only if enriched) -->
					{#if hasEnrichedData && endpoint.request_verb}
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<span class={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${getMethodColor(endpoint.request_verb)}`}>
								{endpoint.request_verb}
							</span>
							<code class="text-xs font-medium break-all ui-muted">
								{endpoint.request_url}
							</code>
						</div>
					{/if}

					<!-- Tags and Links -->
					<div class="mt-3 pt-3 border-t space-y-2 ui-border">
						<!-- Tags -->
						{#if endpoint.tags && endpoint.tags.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each endpoint.tags.slice(0, 3) as tag}
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs ui-panel ui-muted">
										{tag}
									</span>
								{/each}
								{#if endpoint.tags.length > 3}
									<span class="text-xs ui-muted">+{endpoint.tags.length - 3}</span>
								{/if}
							</div>
						{/if}

						<!-- Links -->
						<div class="flex flex-col items-end gap-1">
							<a
								href={buildTellMeMoreUrl(endpoint.operation_id)}
								class="text-xs hover:underline ui-text-brand"
								title="Ask Opey about this endpoint"
							>
								Tell Me More
							</a>
							<div class="flex items-center gap-2">
								<a
									href={buildApiExplorerUrl(endpoint.operation_id)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-xs hover:underline ui-text-brand"
									title="View in API Explorer"
								>
									Explore: <span class="font-mono">{endpoint.operation_id}</span>
								</a>
								<button
									type="button"
									onclick={(e) => { e.preventDefault(); e.stopPropagation(); copyCard(endpoint); }}
									class="transition-colors cursor-pointer ui-muted"
									title="Copy Endpoint summary"
								>
									{#if copiedIds.has(endpoint.operation_id)}
										<Check class="h-4 w-4 ui-text-success" />
									{:else}
										<Copy class="h-4 w-4" />
									{/if}
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<p class="mt-6 text-center text-sm ui-muted">
			Showing {data.endpoints.length} featured endpoint{data.endpoints.length === 1 ? '' : 's'}
		</p>
	{:else}
		<div class="rounded-lg p-8 text-center ui-panel">
			<p class="ui-muted">
				No featured endpoints available at this time.
			</p>
		</div>
	{/if}
</div>
