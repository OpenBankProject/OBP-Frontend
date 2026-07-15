// Lightweight markdown helpers for the featured-endpoints page. Kept as plain
// functions (no Svelte) so the security-relevant sanitization can be unit tested.

// Convert markdown to clean text (for finding cut points)
export function markdownToText(markdown: string): string {
	return markdown
		.replace(/^#{1,6}\s+/gm, '') // Remove heading markers
		.replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
		.replace(/\*([^*]+)\*/g, '$1') // Italic
		.replace(/`([^`]+)`/g, '$1') // Inline code
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
		.replace(/^\s*[-*+]\s+/gm, '') // List markers
		.replace(/^\s*\d+\.\s+/gm, '') // Numbered list markers
		.replace(/\n+/g, ' ') // Newlines to spaces
		.replace(/\s+/g, ' ')
		.trim();
}

// Only allow http(s) and relative URLs as markdown link targets; anything else
// (javascript:, data:, vbscript:, ...) is neutralized to avoid script execution.
// Protocol-relative (`//host`) and backslash (`/\host`) values resolve to a
// different host in the browser, so they are rejected before the allow-regex.
export function sanitizeLinkHref(href: string): string {
	const trimmed = href.trim();
	const isSafe =
		!trimmed.startsWith('//') &&
		!trimmed.startsWith('/\\') &&
		/^(https?:\/\/|\/|#|\.\.?\/)/i.test(trimmed);
	const safeHref = isSafe ? trimmed : '#';
	return safeHref
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Convert markdown to HTML (for rendering)
export function markdownToHtml(markdown: string): string {
	return (
		markdown
			// Escape HTML first
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			// Then apply markdown formatting
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
			.replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
			.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded break-all">$1</code>') // Inline code
			.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				(_match, text, href) =>
					`<a href="${sanitizeLinkHref(href)}" class="text-primary-500 dark:text-primary-200 hover:underline">${text}</a>`
			) // Links
			.replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>') // Headings to bold
			.replace(/\n\n+/g, '</p><p>') // Paragraph breaks
			.replace(/\n/g, ' ') // Single newlines to spaces
			.replace(/^/, '<p>') // Wrap in paragraph
			.replace(/$/, '</p>')
			.replace(/<p><\/p>/g, '')
	); // Remove empty paragraphs
}
