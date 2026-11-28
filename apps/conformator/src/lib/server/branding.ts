/*
 * Copyright (C) 2026 TESOBE GmbH
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

/** The Conformator's theme, extra stylesheet and favicon, from CONFORMATOR_THEME, CONFORMATOR_STYLESHEET_URL and CONFORMATOR_FAVICON_URL. They are read once, so a change takes effect when the Conformator restarts. */
export const conformatorBranding: ThemeBranding = themeBranding(env, 'CONFORMATOR', '/favicon.png');
