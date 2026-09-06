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
	interface PageHeaderProps {
		isAuthenticated?: boolean;
		username?: string;
		profileUrl?: string;
		loginUrl?: string;
		logoutUrl?: string;
		registerUrl?: string;
	}

	let {
		isAuthenticated = false,
		username = '',
		profileUrl = '/user',
		loginUrl = '/login',
		logoutUrl = '/logout',
		registerUrl = '/register'
	}: PageHeaderProps = $props();
</script>

<div
	class="bg-opacity-0 flex items-center justify-end p-4"
	style="height: 80px; flex-shrink: 0;"
>
	{#if isAuthenticated}
		<span class="mx-4 hover:text-tertiary-400"><a href={profileUrl}>{username}</a></span>
		<button type="button" class="btn preset-outlined-primary-500"
			><a href={logoutUrl}>Logout</a></button
		>
	{:else}
		<span class="mx-4 hover:text-tertiary-400"><a href={registerUrl}>Register</a> </span>
		<button type="button" class="btn preset-filled-surface-950-50"
			><a href={loginUrl}>Login</a></button
		>
	{/if}
</div>
