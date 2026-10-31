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
/** How an installation brands Cohort: shown in every page, and set in the API Manager or the environment. */
export interface Branding {
	/** The name in the title and top bar; '' means the default (`app_name` in the locale). */
	name: string;
	logoUrl: string;
	darkLogoUrl: string;
	faviconUrl: string;
	/** The Skeleton theme, the `data-theme` of <html>. */
	theme: string;
	/** A stylesheet loaded after Cohort's own, e.g. one defining the theme above; '' for none. */
	stylesheetUrl: string;
}

export const DEFAULT_BRANDING: Branding = {
	name: '',
	logoUrl: '/logo2x-1.png',
	darkLogoUrl: '/obp_logo.png',
	faviconUrl: '/favicon.png',
	theme: 'obptheme',
	stylesheetUrl: ''
};

/** A URL Cohort will put in the page: http(s) or a path on this site, never javascript: or data:. */
export function safeUrl(value: string, fallback: string): string {
	const v = value.trim();
	return /^(https?:\/\/|\/(?!\/))/i.test(v) ? v : fallback;
}

/** A theme name as it may appear in an attribute. */
export function safeTheme(value: string): string {
	return /^[a-z0-9_-]{1,64}$/i.test(value.trim()) ? value.trim() : DEFAULT_BRANDING.theme;
}

/** Escapes a value for an HTML attribute, for the placeholders in app.html. */
export function attr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
