<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	// OBP role names are single CamelCase words (e.g. CanCreateEntitlementAtAnyBank),
	// so the browser has nowhere to wrap them. Insert <wbr> at word boundaries:
	// the name wraps cleanly and still copies as the exact role name.
	let { name }: { name: string } = $props();

	const parts = $derived(
		(name ?? '').split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=_)/)
	);
</script>

<span class="role-name-text">{#each parts as part, i}{#if i > 0}<wbr />{/if}{part}{/each}</span>

<style>
	.role-name-text {
		overflow-wrap: anywhere;
	}
</style>
