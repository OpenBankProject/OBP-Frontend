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
 * A simple reactive store for the current page's entity heading.
 * Pages set this to the name/title of the entity being viewed
 * (e.g. "Singapore BioTech Solutions Pte Ltd" on a customer page).
 *
 * The Opey Insight Bar reads this to enrich its display and "Ask Opey" prompt.
 *
 * Usage from any page:
 *   import { pageHeading } from '$lib/stores/pageHeading.svelte';
 *   pageHeading.set("Singapore BioTech Solutions Pte Ltd");
 */

let heading = $state("");

export const pageHeading = {
	get value() { return heading; },
	set(text: string) { heading = text; },
	clear() { heading = ""; },
};
