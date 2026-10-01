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
 * The OBP webui_props the frontend apps read.
 *
 * A webui_prop is a plain string. The apps render it as markdown unless its name
 * is in WEB_UI_PROPS_NOT_MARKDOWN (see renderWebUiProp). Props shown inside a
 * heading are `inline`: only inline markdown (emphasis, code, links) applies.
 *
 * Props with an `envVar` fall back to that environment variable when the
 * webui_prop is not set (webui_prop → env var → built-in default).
 */

/** Props whose value is used as-is (e.g. as an href), never parsed as markdown. */
export const WEB_UI_PROPS_NOT_MARKDOWN: readonly string[] = ['webui_support_platform_url'];

export function isWebUiPropMarkdown(name: string): boolean {
	return !WEB_UI_PROPS_NOT_MARKDOWN.includes(name);
}

export interface KnownWebUiProp {
	name: string;
	usedBy: string;
	envVar?: string;
	inline?: boolean;
}

/** `PUBLIC_WELCOME_TITLE` → `webui_welcome_title` */
export function webUiPropNameForEnvVar(envVar: string): string {
	return 'webui_' + envVar.replace(/^PUBLIC_/, '').toLowerCase();
}

function fromEnvVar(envVar: string, usedBy: string, inline = false): KnownWebUiProp {
	return { name: webUiPropNameForEnvVar(envVar), usedBy, envVar, ...(inline && { inline }) };
}

export const KNOWN_WEB_UI_PROPS: KnownWebUiProp[] = [
	fromEnvVar('PUBLIC_WELCOME_TITLE', 'Portal home', true),
	fromEnvVar('PUBLIC_HELP_QUESTION', 'Portal home', true),
	fromEnvVar('PUBLIC_WELCOME_DESCRIPTION', 'Portal home'),
	fromEnvVar('PUBLIC_WELCOME_MESSAGE', 'Portal first-visit bubble'),
	fromEnvVar('PUBLIC_WELCOME_TITLE_MANAGER', 'API Manager home', true),
	fromEnvVar('PUBLIC_HELP_QUESTION_MANAGER', 'API Manager home', true),
	fromEnvVar('PUBLIC_WELCOME_DESCRIPTION_MANAGER', 'API Manager home'),
	{ name: 'webui_terms_and_conditions', usedBy: 'Portal registration' },
	{ name: 'webui_privacy_policy', usedBy: 'Portal registration' },
	{ name: 'webui_support_platform_url', usedBy: 'Portal and API Manager support' }
];

export function findKnownWebUiProp(name: string): KnownWebUiProp | undefined {
	return KNOWN_WEB_UI_PROPS.find((p) => p.name === name);
}
