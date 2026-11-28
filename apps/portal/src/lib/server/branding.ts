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
import { themeBranding, type ThemeBranding } from '@obp/shared/branding';

/** The Portal's theme, extra stylesheet and favicon, from PORTAL_THEME, PORTAL_STYLESHEET_URL and PORTAL_FAVICON_URL. They are read once, so a change takes effect when the Portal restarts. */
export const portalBranding: ThemeBranding = themeBranding(env, 'PORTAL', '/favicon.png');
