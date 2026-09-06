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
 * A simple reactive store that pages write to after loading data.
 * The Opey Insight Bar reads from this to enrich notebook entries.
 *
 * Usage from any page:
 *   import { pageDataSummary } from '$lib/stores/pageDataSummary.svelte';
 *   pageDataSummary.set("12 banks loaded, 3 have routings configured");
 */

let summary = $state("");

export const pageDataSummary = {
	get value() { return summary; },
	set(text: string) { summary = text; },
	clear() { summary = ""; },
};
