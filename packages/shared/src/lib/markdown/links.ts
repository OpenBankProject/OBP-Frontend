/**
 * Renders plain text that may contain markdown-style links — `[label](url)` —
 * into an HTML string. Everything except the generated <a> tags is escaped,
 * so the result is safe to use with {@html}. Only http(s), mailto: and
 * site-relative (/path, #anchor) URLs become links; anything else
 * (e.g. javascript:) is rendered as escaped literal text.
 *
 * Intended for operator-configured one-liners (env vars like
 * PUBLIC_WELCOME_DESCRIPTION) where full markdown would be overkill.
 */

const LINK_PATTERN = /\[([^\]]+)\]\(([^()\s]+)\)/g;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function isSafeHref(url: string): boolean {
	if (url.startsWith('//')) {
		// Protocol-relative URLs inherit the page scheme but hide the host; disallow
		return false;
	}
	return /^(https?:\/\/|mailto:|\/|#)/i.test(url);
}

export interface RenderTextWithLinksOptions {
	/** CSS class(es) applied to each generated <a> tag */
	linkClass?: string;
}

export function renderTextWithLinks(
	text: string,
	options: RenderTextWithLinksOptions = {}
): string {
	const classAttr = options.linkClass ? ` class="${escapeHtml(options.linkClass)}"` : '';
	let html = '';
	let lastIndex = 0;
	for (const match of text.matchAll(LINK_PATTERN)) {
		const [full, label, url] = match;
		html += escapeHtml(text.slice(lastIndex, match.index));
		if (isSafeHref(url)) {
			const opensNewTab = /^https?:\/\//i.test(url);
			const targetAttr = opensNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
			html += `<a href="${escapeHtml(url)}"${classAttr}${targetAttr}>${escapeHtml(label)}</a>`;
		} else {
			html += escapeHtml(full);
		}
		lastIndex = match.index + full.length;
	}
	return html + escapeHtml(text.slice(lastIndex));
}
