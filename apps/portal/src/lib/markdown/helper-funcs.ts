import { createLogger } from '$lib/utils/logger';
const logger = createLogger('MarkdownHelper');
import MarkdownIt from "markdown-it";

// Prism is loaded dynamically on the client side only — it depends on window/DOM
// and crashes during SSR. On the server, renderMarkdown still works but
// returns code blocks without syntax highlighting.
let Prism: any = null;

if (typeof window !== 'undefined') {
	(async () => {
		const mod = await import('prismjs');
		Prism = mod.default || mod;
		// Language components are side-effect imports that register on the Prism global.
		// They have no type declarations, hence the ignores.
		// @ts-ignore
		await import('prismjs/components/prism-bash');
		// @ts-ignore
		await import('prismjs/components/prism-javascript');
		// @ts-ignore
		await import('prismjs/components/prism-python');
		// @ts-ignore
		await import('prismjs/components/prism-go');
		// @ts-ignore
		await import('prismjs/components/prism-json');
		// @ts-ignore
		await import('prismjs/components/prism-liquid');
		// @ts-ignore
		await import('prismjs/components/prism-markdown');
		// @ts-ignore
		await import('prismjs/components/prism-markup-templating');
		// @ts-ignore
		await import('prismjs/components/prism-php');
		// @ts-ignore
		await import('prismjs/components/prism-scss');
		// @ts-ignore
		await import('prismjs/components/prism-yaml');
		// @ts-ignore
		await import('prismjs/components/prism-markup');
		// @ts-ignore
		await import('prismjs/components/prism-typescript');
		// @ts-ignore
		await import('prismjs/components/prism-http');
	})();
}

function _highlightCode(content: string, language: string) {
	if (Prism?.languages[language]) {
		return Prism.highlight(content, Prism.languages[language], language);
	} else {
		logger.warn(`could not highlight ${language} code block, add language to dependencies`);
		return content;
	}
}

export function renderMarkdown(content: string) {
	const markdown = new MarkdownIt({
		highlight: (str: string, lang: string): string => {
			if (lang && Prism?.languages[lang]) {
				try {
					return `<pre class="language-${lang}"><code>${_highlightCode(str, lang)}</code></pre>`;
				} catch (error) {
					logger.warn(`error hilighting ${lang} code block: ${error}`);
				}
			} else if (!lang) {
				logger.warn('No language specified for code block');
			} else if (Prism && !Prism.languages[lang]) {
				logger.warn(
					`Language ${lang} not recognized or not installed, see imports for this component`
				);
			}

			return `<pre class="language-"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
		}
	});

	return markdown.render(content);
}
