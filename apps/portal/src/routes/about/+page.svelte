<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	let htmlContent = $state('');

	function formatBuildTime(isoString: string): string {
		try {
			const date = new Date(isoString);
			return date.toLocaleString();
		} catch {
			return isoString;
		}
	}

	// Default markdown content if environment variable is not set
	const defaultMarkdown = `# About OBP Portal

## What is OBP Portal?

The Open Bank Project (OBP) Portal is a comprehensive developer portal that provides access to banking APIs and tools for building financial applications. It serves as the gateway for developers, fintech companies, and financial institutions to explore, integrate, and leverage open banking capabilities.

## About Open Bank Project

The Open Bank Project is an open source API and App store for banks that empowers financial institutions to securely and rapidly enhance their digital offerings using an ecosystem of 3rd party applications and services. The project provides a RESTful API that allows developers to build financial applications on top of banking data.`;

	onMount(async () => {
		// Dynamically import markdown-it to avoid SSR issues
		const MarkdownIt = (await import('markdown-it')).default;
		const md = new MarkdownIt({
			html: true,
			linkify: true,
			typographer: true
		});

		// Get markdown content from environment variable or use default
		const markdownContent = env.PUBLIC_ABOUT_TEXT || defaultMarkdown;

		// Render markdown to HTML
		htmlContent = md.render(markdownContent);
	});
</script>

<svelte:head>
	<title>About - OBP Portal</title>
	<meta name="description" content="About Open Bank Project Portal" />
</svelte:head>

<div class="flex flex-col space-y-6 p-4">
	<div class="mx-auto w-full max-w-4xl">
		{#if htmlContent}
			<div class="prose prose-lg max-w-none dark:prose-invert">
				{@html htmlContent}
			</div>
		{:else}
			<div class="flex items-center justify-center py-8">
				<p class="text-surface-600-400">Loading...</p>
			</div>
		{/if}

		<!-- Rendered outside the markdown so it survives PUBLIC_ABOUT_TEXT overrides -->
		<h2 class="h3 mt-8" data-testid="useful-links-title">Useful Links</h2>
		<ul class="mt-4 list-disc space-y-2 pl-5">
			<li>
				<a
					href="/status"
					class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
					data-testid="link-status"
				>
					Status
				</a>
				— check the health of this portal and its services
			</li>
			<li>
				<a
					href="https://www.openbankproject.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
					data-testid="link-website"
				>
					Official Website
				</a>
			</li>
			<li>
				<a
					href="https://github.com/OpenBankProject"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
					data-testid="link-github"
				>
					GitHub Organization
				</a>
			</li>
			<li>
				<a
					href={env.PUBLIC_OBP_CHAT_URL || 'https://chat.openbankproject.com'}
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
					data-testid="link-chat"
				>
					Open Bank Project Chat
				</a>
			</li>
		</ul>

		<h2 class="h3 mt-8" data-testid="license-title">License</h2>
		<p class="mt-4">
			This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
		</p>

		<p class="mt-8 border-t border-surface-200-800 pt-6 text-sm text-surface-600-400">
			© TESOBE 2011-{Math.max(new Date().getFullYear(), 2026)}. All rights reserved.
		</p>

		<!-- Version Information Footer -->
		<div class="mt-12 border-t border-surface-200-800 pt-8">
			<div class="text-sm text-surface-600-400">
				<span class="font-medium">Version:</span>
				<span class="font-mono text-surface-900-100">{__APP_VERSION__}</span>
				{#if __GIT_COMMIT__ !== 'unknown'}
					<span class="mx-2">•</span>
					<span class="font-medium">Commit:</span>
					<span class="font-mono text-surface-900-100">{__GIT_COMMIT__}</span>
				{/if}
				{#if __GIT_BRANCH__ !== 'unknown'}
					<span class="mx-2">•</span>
					<span class="font-medium">Branch:</span>
					<span class="font-mono text-surface-900-100">{__GIT_BRANCH__}</span>
				{/if}
				<span class="mx-2">•</span>
				<span class="font-medium">Built:</span>
				<span class="font-mono text-surface-900-100">{formatBuildTime(__BUILD_TIME__)}</span>
				<span class="mx-2">•</span>
				<a
					href="https://github.com/OpenBankProject"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary-500 hover:text-primary-400 hover:underline"
				>
					GitHub
				</a>
			</div>
		</div>
	</div>
</div>