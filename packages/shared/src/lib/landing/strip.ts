/**
 * Landing page blocks: preview-grade stripping of active content.
 *
 * Removes everything that could execute or navigate on its own: script, iframe,
 * object, embed, link, meta, base and svg/math foreign content, inline event
 * handlers, and javascript:/data: URLs. Author pages are HTML + CSS only, so
 * nothing legitimate is lost.
 *
 * This is deliberately simple and regex-based, which is fine for previewing a
 * page in an admin tool. Publishing to the Portal needs a real HTML sanitiser
 * (DOM-based, allowlist) in front of it, not instead of it.
 */

const REMOVE_ELEMENTS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'svg', 'math', 'template', 'noscript'];

export function stripActiveContent(html: string): string {
	let out = html ?? '';
	// Elements with content: remove the whole element. Case-insensitive, dotall.
	for (const tag of REMOVE_ELEMENTS) {
		out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
		// Void or unclosed forms of the same tags.
		out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
	}
	// Inline event handlers: onclick="…", onload='…', onerror=x
	out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
	// javascript:, vbscript: and data: URLs in href/src/action/formaction/xlink:href
	out = out.replace(
		/(\s(?:href|src|action|formaction|xlink:href|poster|background)\s*=\s*)(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|\s*(?:javascript|vbscript|data):[^\s>]+)/gi,
		'$1"#"'
	);
	// CSS that pulls in remote resources or runs expressions.
	out = out.replace(/@import\s+[^;]+;?/gi, '');
	out = out.replace(/expression\s*\(/gi, 'blocked(');
	out = out.replace(/behavior\s*:/gi, 'blocked:');
	return out;
}
