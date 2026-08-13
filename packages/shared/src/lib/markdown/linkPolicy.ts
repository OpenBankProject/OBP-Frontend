/**
 * Link-host policy for user-generated content (chat messages).
 *
 * Untrusted authors can post URLs; readers are protected at render time by
 * refusing to make links clickable unless their host is on an allowlist
 * derived from the deployment's own configuration. The text itself is kept —
 * nothing is deleted from the message, the URL just stays inert text.
 *
 * The check parses the URL and compares hostnames (exact match or subdomain
 * of an allowed host). Never test with substring matching — e.g.
 * "https://openbankproject.com.evil.example" contains the OBP domain but must
 * not pass.
 */

/** Hostnames (lowercase) of the given config URLs — invalid/empty entries are skipped. */
export function collectLinkHosts(urls: Array<string | undefined | null>): string[] {
	const hosts = new Set<string>();
	for (const url of urls) {
		if (!url) continue;
		try {
			hosts.add(new URL(url).hostname.toLowerCase());
		} catch {
			// not a URL (e.g. a bare hostname from an allowlist env var) — accept as host
			const bare = url.trim().toLowerCase();
			if (/^[a-z0-9.-]+$/.test(bare) && bare.length > 0) {
				hosts.add(bare);
			}
		}
	}
	return [...hosts];
}

export function isAllowedLinkHref(href: string, allowedHosts: string[]): boolean {
	const trimmed = href.trim();
	if (trimmed === '') return true;

	// Site-relative links stay within this deployment
	if (/^[#?/]/.test(trimmed) && !trimmed.startsWith('//')) return true;

	if (/^mailto:/i.test(trimmed)) return true;

	// Absolute http(s) and protocol-relative URLs: judge by hostname
	let parseable = trimmed;
	if (trimmed.startsWith('//')) parseable = `https:${trimmed}`;
	if (!/^https?:\/\//i.test(parseable)) return false;

	let hostname: string;
	try {
		hostname = new URL(parseable).hostname.toLowerCase();
	} catch {
		return false;
	}
	if (allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
		return true;
	}
	// localhost, *.localhost, 127.0.0.1 and ::1 are the same place; if any
	// loopback form is allowed (dev deployments), all loopback forms pass.
	return isLoopback(hostname) && allowedHosts.some(isLoopback);
}

function isLoopback(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]' ||
		hostname === '::1' ||
		hostname.endsWith('.localhost')
	);
}

/**
 * Replace anchors whose href fails the host policy with a plain <span>
 * carrying the anchor's visible text. Expects sanitized HTML; runs in the
 * browser (uses DOM parsing).
 */
export function filterLinksByHost(html: string, allowedHosts: string[]): string {
	const template = document.createElement('template');
	template.innerHTML = html;
	for (const anchor of template.content.querySelectorAll('a[href]')) {
		const href = anchor.getAttribute('href') ?? '';
		if (!isAllowedLinkHref(href, allowedHosts)) {
			const span = document.createElement('span');
			span.className = 'blocked-link';
			span.textContent = anchor.textContent;
			anchor.replaceWith(span);
		}
	}
	return template.innerHTML;
}
