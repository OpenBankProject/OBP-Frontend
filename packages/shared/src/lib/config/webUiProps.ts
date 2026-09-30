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
 * The OBP webui_props the frontend apps read, and how each value is rendered.
 *
 * A webui_prop is a plain string; whether it is markdown depends entirely on the
 * page that shows it. The API Manager uses `format` to preview a value the way
 * its page will render it.
 *
 * Props with an `envVar` fall back to that environment variable when the
 * webui_prop is not set (webui_prop → env var → built-in default).
 */

/**
 * - `text`: shown literally
 * - `text-with-links`: literal text where `[label](url)` becomes a link (renderTextWithLinks)
 * - `markdown`: full markdown (renderMarkdown)
 * - `url`: a URL the page links to
 */
export type WebUiPropFormat = 'text' | 'text-with-links' | 'markdown' | 'url';

export interface KnownWebUiProp {
	name: string;
	format: WebUiPropFormat;
	usedBy: string;
	envVar?: string;
}

/** `PUBLIC_WELCOME_TITLE` → `webui_welcome_title` */
export function webUiPropNameForEnvVar(envVar: string): string {
	return 'webui_' + envVar.replace(/^PUBLIC_/, '').toLowerCase();
}

function fromEnvVar(envVar: string, format: WebUiPropFormat, usedBy: string): KnownWebUiProp {
	return { name: webUiPropNameForEnvVar(envVar), format, usedBy, envVar };
}

export const KNOWN_WEB_UI_PROPS: KnownWebUiProp[] = [
	fromEnvVar('PUBLIC_WELCOME_TITLE', 'text', 'Portal home'),
	fromEnvVar('PUBLIC_HELP_QUESTION', 'text', 'Portal home'),
	fromEnvVar('PUBLIC_WELCOME_DESCRIPTION', 'text-with-links', 'Portal home'),
	fromEnvVar('PUBLIC_WELCOME_MESSAGE', 'text-with-links', 'Portal first-visit bubble'),
	{ name: 'webui_terms_and_conditions', format: 'markdown', usedBy: 'Portal registration' },
	{ name: 'webui_privacy_policy', format: 'markdown', usedBy: 'Portal registration' },
	{ name: 'webui_support_platform_url', format: 'url', usedBy: 'Portal support' }
];

export function findKnownWebUiProp(name: string): KnownWebUiProp | undefined {
	return KNOWN_WEB_UI_PROPS.find((p) => p.name === name);
}
