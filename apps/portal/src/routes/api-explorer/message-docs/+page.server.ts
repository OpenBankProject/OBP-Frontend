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
import { redirect } from '@sveltejs/kit';
import { explorerMessageDocsUrl } from '@obp/shared/explorer';
import { DEFAULT_CONNECTOR } from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * There is nothing useful to show without a connector, so land on the usual one — carrying the
 * query string, or a link like /message-docs?q=kafka would arrive unfiltered.
 */
export const load: PageServerLoad = async ({ url }) => {
	redirect(307, explorerMessageDocsUrl(DEFAULT_CONNECTOR) + url.search);
};
