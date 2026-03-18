<script lang="ts">
	import { Copy, Check } from '@lucide/svelte';

	interface EndpointData {
		operation_id: string;
		summary?: string;
		description_markdown?: string;
		request_verb?: string;
		request_url?: string;
		tags?: string[];
	}

	interface Props {
		endpoint: EndpointData;
		apiExplorerUrl?: string;
	}

	let { endpoint, apiExplorerUrl = '' }: Props = $props();

	const DESCRIPTION_CUTOFF_LENGTH = 500;
	const DESCRIPTION_CUTOFF_BUFFER = 200;

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

	let copied = $state(false);

	function getMethodColor(method: string): string {
		switch (method.toUpperCase()) {
			case 'GET':
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
			case 'POST':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
			case 'PUT':
				return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'DELETE':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
			case 'PATCH':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
		}
	}

	function buildApiExplorerUrl(operationId: string): string {
		if (!apiExplorerUrl) return '#';
		const hyphenIndex = operationId.indexOf('-');
		const version = hyphenIndex > 0 ? operationId.substring(0, hyphenIndex) : operationId;
		const baseUrl = apiExplorerUrl.replace(/\/$/, '');
		return `${baseUrl}/resource-docs/${version}?operationid=${operationId}`;
	}

	function buildTellMeMoreUrl(operationId: string): string {
		const question = `Tell me more about the API endpoint with operation ID: ${operationId}`;
		return `/?ask=${encodeURIComponent(question)}`;
	}

	function markdownToHtml(markdown: string): string {
		return markdown
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\*([^*]+)\*/g, '<em>$1</em>')
			.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded break-all">$1</code>')
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-500 dark:text-primary-200 hover:underline">$1</a>')
			.replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
			.replace(/\n\n+/g, '</p><p>')
			.replace(/\n/g, ' ')
			.replace(/^/, '<p>')
			.replace(/$/, '</p>')
			.replace(/<p><\/p>/g, '');
	}

	function getDescriptionPreview(markdown: string, maxLength: number = DESCRIPTION_CUTOFF_LENGTH, summary?: string): string {
		let text = markdown;

		if (summary) {
			const cleanSummary = summary.trim();
			const headingPattern = new RegExp(`^#+\\s*${cleanSummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n*`, 'i');
			text = text.replace(headingPattern, '').trim();
			if (text.startsWith(cleanSummary)) {
				text = text.substring(cleanSummary.length).trim();
			}
		}

		let cutoffIndex = text.length;
		let stoppedByPhrase = false;
		for (const phrase of STOP_PHRASES) {
			const index = text.indexOf(phrase);
			if (index !== -1 && index < cutoffIndex) {
				cutoffIndex = index;
				stoppedByPhrase = true;
			}
		}

		if (text.length <= maxLength && cutoffIndex === text.length) {
			return markdownToHtml(text);
		}

		const abbreviations = ['i.e.', 'e.g.', 'etc.', 'vs.', 'Mr.', 'Mrs.', 'Dr.', 'Jr.', 'Sr.', 'Inc.', 'Ltd.', 'Corp.'];

		function findSentenceBoundary(region: string): number {
			for (let i = region.length - 1; i >= 0; i--) {
				const char = region[i];
				if (char === '.' || char === '!' || char === '?') {
					const isEndOfRegion = i === region.length - 1;
					const nextChar = !isEndOfRegion ? region[i + 1] : '';
					const charAfterSpace = (i + 2 < region.length) ? region[i + 2] : '';

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
			return -1;
		}

		const extendedLimit = maxLength + DESCRIPTION_CUTOFF_BUFFER;
		const hardLimit = stoppedByPhrase ? cutoffIndex : Math.min(text.length, extendedLimit);

		const searchRegion = text.substring(0, hardLimit);
		let sentenceEnd = findSentenceBoundary(searchRegion);

		if (sentenceEnd > 50) {
			return markdownToHtml(text.substring(0, sentenceEnd).trim());
		}

		const result = text.substring(0, stoppedByPhrase ? cutoffIndex : hardLimit).trim();
		return markdownToHtml(result);
	}

	function getMarkdownPreview(markdown: string, maxLength: number = 2000, summary?: string): string {
		let text = markdown;
		if (summary) {
			const cleanSummary = summary.trim();
			const headingPattern = new RegExp(`^#+\\s*${cleanSummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n*`, 'i');
			text = text.replace(headingPattern, '').trim();
			if (text.startsWith(cleanSummary)) {
				text = text.substring(cleanSummary.length).trim();
			}
		}
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

	function buildCardText(): string {
		const lines: string[] = [];
		lines.push(`## ${endpoint.summary || endpoint.operation_id}`);
		lines.push('');
		if (endpoint.description_markdown) {
			const preview = getMarkdownPreview(endpoint.description_markdown, 2000, endpoint.summary);
			lines.push(preview);
			lines.push('');
		}
		if (endpoint.request_verb && endpoint.request_url) {
			lines.push(`${endpoint.request_verb} ${endpoint.request_url}`);
			lines.push('');
		}
		if (endpoint.tags && endpoint.tags.length > 0) {
			lines.push(`Tags: ${endpoint.tags.join(', ')}`);
			lines.push('');
		}
		lines.push(`Operation ID: ${endpoint.operation_id}`);
		lines.push(`Tell Me More: ${window.location.origin}${buildTellMeMoreUrl(endpoint.operation_id)}`);
		lines.push(`Explore: ${buildApiExplorerUrl(endpoint.operation_id)}`);
		return lines.join('\n');
	}

	async function copyCard() {
		const text = buildCardText();
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
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	let hasEnrichedData = $derived(!!endpoint.summary);
</script>

<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
	<!-- Title -->
	<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
		{endpoint.summary || endpoint.operation_id}
	</h3>

	<!-- Description -->
	{#if endpoint.description_markdown}
		<div class="mt-2 flex-grow text-sm text-gray-600 dark:text-gray-400 prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words">
			{@html getDescriptionPreview(endpoint.description_markdown, DESCRIPTION_CUTOFF_LENGTH, endpoint.summary)}
		</div>
	{/if}

	<!-- Verb and Path -->
	{#if hasEnrichedData && endpoint.request_verb}
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<span class={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${getMethodColor(endpoint.request_verb)}`}>
				{endpoint.request_verb}
			</span>
			<code class="text-xs font-medium text-gray-600 dark:text-gray-400 break-all">
				{endpoint.request_url}
			</code>
		</div>
	{/if}

	<!-- Tags and Links -->
	<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
		{#if endpoint.tags && endpoint.tags.length > 0}
			<div class="flex flex-wrap gap-1">
				{#each endpoint.tags.slice(0, 3) as tag}
					<span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
						{tag}
					</span>
				{/each}
				{#if endpoint.tags.length > 3}
					<span class="text-xs text-gray-400">+{endpoint.tags.length - 3}</span>
				{/if}
			</div>
		{/if}

		<div class="flex flex-col items-end gap-1">
			<a
				href={buildTellMeMoreUrl(endpoint.operation_id)}
				class="text-xs text-secondary-500 dark:text-secondary-300 hover:underline"
				title="Ask Opey about this endpoint"
			>
				Tell Me More
			</a>
			<div class="flex items-center gap-2">
				<a
					href={buildApiExplorerUrl(endpoint.operation_id)}
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs text-primary-500 dark:text-primary-200 hover:underline"
					title="View in API Explorer"
				>
					Explore: <span class="font-mono">{endpoint.operation_id}</span>
				</a>
				<button
					type="button"
					onclick={(e) => { e.preventDefault(); e.stopPropagation(); copyCard(); }}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
					title="Copy Endpoint summary"
				>
					{#if copied}
						<Check class="h-4 w-4 text-green-500" />
					{:else}
						<Copy class="h-4 w-4" />
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
