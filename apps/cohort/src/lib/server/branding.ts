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
import { resolveWebUiValues } from '@obp/shared/server/obp';
import { createLogger } from '@obp/shared/utils';
import { DEFAULT_BRANDING, safeTheme, safeUrl, type Branding } from '$lib/branding';
import { obpRequests } from './obp';

const logger = createLogger('CohortBranding');

/**
 * Each value comes from a webui_prop (set in the API Manager, takes effect without a restart), then an env var,
 * then the default. The webui_prop name is the env var's, lower case, after webui_: COHORT_NAME → webui_cohort_name.
 */
export const BRANDING_SETTINGS = {
	name: { envVar: 'COHORT_NAME', default: DEFAULT_BRANDING.name },
	logoUrl: { envVar: 'COHORT_LOGO_URL', default: DEFAULT_BRANDING.logoUrl },
	darkLogoUrl: { envVar: 'COHORT_DARK_LOGO_URL', default: DEFAULT_BRANDING.darkLogoUrl },
	faviconUrl: { envVar: 'COHORT_FAVICON_URL', default: DEFAULT_BRANDING.faviconUrl },
	theme: { envVar: 'COHORT_THEME', default: DEFAULT_BRANDING.theme },
	stylesheetUrl: { envVar: 'COHORT_STYLESHEET_URL', default: DEFAULT_BRANDING.stylesheetUrl }
};

export async function branding(): Promise<Branding> {
	try {
		const v = await resolveWebUiValues(obpRequests.get, env, BRANDING_SETTINGS);
		return {
			name: v.name.value.trim(),
			logoUrl: safeUrl(v.logoUrl.value, DEFAULT_BRANDING.logoUrl),
			darkLogoUrl: safeUrl(v.darkLogoUrl.value, DEFAULT_BRANDING.darkLogoUrl),
			faviconUrl: safeUrl(v.faviconUrl.value, DEFAULT_BRANDING.faviconUrl),
			theme: safeTheme(v.theme.value),
			stylesheetUrl: v.stylesheetUrl.value.trim() ? safeUrl(v.stylesheetUrl.value, '') : ''
		};
	} catch (err) {
		logger.warn('Could not read branding; using the defaults:', err);
		return DEFAULT_BRANDING;
	}
}
