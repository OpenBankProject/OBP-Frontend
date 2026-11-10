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
import { env } from '$env/dynamic/private';
import { DEFAULT_BRANDING, safeTheme, safeUrl, type Branding } from '$lib/branding';

/**
 * Cohort's branding comes from its environment variables only (COHORT_NAME, COHORT_LOGO_URL, COHORT_DARK_LOGO_URL,
 * COHORT_FAVICON_URL, COHORT_THEME, COHORT_STYLESHEET_URL), each with a built-in default. Branding is Cohort's own
 * setting, so it is read from one place: a change takes effect when Cohort restarts.
 */
export async function branding(): Promise<Branding> {
	const value = (name: string) => (env[name] ?? '').trim();
	const stylesheet = value('COHORT_STYLESHEET_URL');
	return {
		name: value('COHORT_NAME'),
		logoUrl: safeUrl(value('COHORT_LOGO_URL'), DEFAULT_BRANDING.logoUrl),
		darkLogoUrl: safeUrl(value('COHORT_DARK_LOGO_URL'), DEFAULT_BRANDING.darkLogoUrl),
		faviconUrl: safeUrl(value('COHORT_FAVICON_URL'), DEFAULT_BRANDING.faviconUrl),
		theme: value('COHORT_THEME') ? safeTheme(value('COHORT_THEME')) : DEFAULT_BRANDING.theme,
		stylesheetUrl: stylesheet ? safeUrl(stylesheet, '') : ''
	};
}
