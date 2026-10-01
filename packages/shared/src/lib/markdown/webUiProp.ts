/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Renders a webui_prop value for display: markdown unless the prop is in
 * WEB_UI_PROPS_NOT_MARKDOWN, in which case it is escaped text.
 *
 * Raw HTML in the value is escaped (markdown-it `html: false`) and markdown-it
 * refuses unsafe link schemes such as javascript:, so the result is safe for
 * {@html}. http(s) links open in a new tab.
 *
 * Use `inline` where the value sits inside a heading or other inline element:
 * only inline markdown (emphasis, code, links) is rendered, no paragraphs.
 */

import MarkdownIt from 'markdown-it';
import { isWebUiPropMarkdown } from '$shared/config/webUiProps';

export interface RenderWebUiPropOptions {
	inline?: boolean;
	/** CSS class(es) applied to each link */
	linkClass?: string;
}

const markdown = new MarkdownIt({ html: false, linkify: false });

const defaultLinkOpen =
	markdown.renderer.rules.link_open ??
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	const token = tokens[idx];
	if (/^https?:\/\//i.test(token.attrGet('href') ?? '')) {
		token.attrSet('target', '_blank');
		token.attrSet('rel', 'noopener noreferrer');
	}
	if (env?.linkClass) token.attrSet('class', env.linkClass);
	return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderWebUiProp(name: string, value: string, options: RenderWebUiPropOptions = {}): string {
	if (!isWebUiPropMarkdown(name)) return markdown.utils.escapeHtml(value);
	const env = { linkClass: options.linkClass };
	return options.inline ? markdown.renderInline(value, env) : markdown.render(value, env);
}
