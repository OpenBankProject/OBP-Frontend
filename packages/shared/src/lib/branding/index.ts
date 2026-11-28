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
 * How an installation brands an OBP-Frontend app: its theme, an extra stylesheet and its favicon. Each app reads these from its own environment variables, named with the app's prefix: for the Portal PORTAL_THEME, PORTAL_STYLESHEET_URL and PORTAL_FAVICON_URL. See docs/branding.md for how to write a theme.
 */

/**
 * A class that picks a colour itself instead of using a named style: a Tailwind palette colour (`text-gray-500`), a theme colour shade (`bg-surface-100`, `border-primary-200-800`) or a Skeleton preset other than the four button presets. Pages use the named styles of packages/shared/styles.css instead, so a theme decides every colour and there are only those few styles. Each converted app has a test that fails on any it finds.
 */
export const COLOUR_CLASS =
	/(?<![\w-])(?:(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|from|to|via|fill|stroke|divide|outline|placeholder|accent|decoration|shadow|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|secondary|tertiary|success|warning|error|surface)-(?:50|[1-9]00|950)(?:-(?:50|[1-9]00|950))?|preset-(?:filled|tonal|outlined)(?:-[a-z]+(?:-\d+)*)?)(?![\w-])/g;

/** The Skeleton presets pages may use: the four button styles. */
export const BUTTON_PRESETS = ['preset-filled-primary-500', 'preset-filled-error-500', 'preset-tonal', 'preset-outlined-surface-500'];

/** The classes in a text that pick a colour themselves, leaving out the four button presets. */
export function colourClasses(text: string): string[] {
	return (text.match(COLOUR_CLASS) ?? []).filter((cls) => !BUTTON_PRESETS.includes(cls));
}

/** A colour written out in CSS rather than taken from a --ui-* variable: hex, rgb(), hsl(), oklch(), white, black or a theme shade. */
const CSS_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^()]*\)|\b(?:white|black)\b|var\(--color-[\w-]+\)/g;
/** A neutral black shadow does not depend on the theme, so a shadow may use one. */
const BLACK_SHADOW = /^rgba?\(\s*0[\s,]+0[\s,]+0\b/;

/**
 * The colours in a Svelte file's <style> blocks and style attributes that do not come from the --ui-* variables of packages/shared/styles.css, as "property: colour".
 */
export function cssColours(text: string): string[] {
	const css = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), ...text.matchAll(/\sstyle="([^"]*)"/g)].map((match) => match[1]).join(';');
	const found: string[] = [];
	for (const declaration of css.matchAll(/([-\w]+)\s*:\s*([^;{}]+)/g)) {
		const property = declaration[1].toLowerCase();
		if (property.startsWith('--ui-')) continue;
		for (const colour of declaration[2].match(CSS_COLOUR) ?? []) {
			if ((property === 'box-shadow' || property === 'text-shadow') && BLACK_SHADOW.test(colour)) continue;
			found.push(`${property}: ${colour}`);
		}
	}
	return found;
}

/** The theme every app ships with, defined in packages/shared/obp-theme.css. */
export const DEFAULT_THEME = 'obptheme';

/** An app's theme, extra stylesheet and favicon. */
export interface ThemeBranding {
	/** The Skeleton theme, the `data-theme` of <html>. */
	theme: string;
	/** A stylesheet loaded after the app's own, for example one defining the theme above; '' for none. */
	stylesheetUrl: string;
	faviconUrl: string;
}

/** A URL an app will put in the page: http(s) or a path on the same site, never javascript: or data:. */
export function safeUrl(value: string, fallback: string): string {
	const trimmed = value.trim();
	return /^(https?:\/\/|\/(?!\/))/i.test(trimmed) ? trimmed : fallback;
}

/** A theme name as it may appear in an attribute; anything else gives the default theme. */
export function safeTheme(value: string): string {
	return /^[a-z0-9_-]{1,64}$/i.test(value.trim()) ? value.trim() : DEFAULT_THEME;
}

/** Escapes a value for an HTML attribute, for the placeholders in app.html. */
export function attr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The theme branding from an app's environment variables: `${prefix}_THEME`, `${prefix}_STYLESHEET_URL` and `${prefix}_FAVICON_URL`, each with a default. A value that is not a safe URL or theme name is ignored.
 */
export function themeBranding(env: Record<string, string | undefined>, prefix: string, defaultFaviconUrl: string): ThemeBranding {
	const value = (name: string) => (env[`${prefix}_${name}`] ?? '').trim();
	const theme = value('THEME');
	const stylesheet = value('STYLESHEET_URL');
	return {
		theme: theme ? safeTheme(theme) : DEFAULT_THEME,
		stylesheetUrl: stylesheet ? safeUrl(stylesheet, '') : '',
		faviconUrl: safeUrl(value('FAVICON_URL'), defaultFaviconUrl)
	};
}

/** Fills the branding placeholders of an app.html: %branding.theme% and %branding.favicon% in attributes, and %branding.stylesheet%, after %sveltekit.head%, with the stylesheet's link or nothing. For a hook's transformPageChunk. */
export function withBranding(html: string, branding: ThemeBranding): string {
	const stylesheet = branding.stylesheetUrl ? `<link rel="stylesheet" href="${attr(branding.stylesheetUrl)}" />` : '';
	return html.replaceAll('%branding.theme%', attr(branding.theme)).replaceAll('%branding.favicon%', attr(branding.faviconUrl)).replace('%branding.stylesheet%', stylesheet);
}
