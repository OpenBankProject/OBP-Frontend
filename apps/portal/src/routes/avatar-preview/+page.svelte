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
	import Avatar from '$lib/components/Avatar.svelte';
	import { userAvatarSeed } from '$lib/avatar/generate';
	import { env } from '$env/dynamic/public';

	const usernames = [
		'simonredfern2025',
		'simonredferncopenhagen',
		'robert.x.0.gh',
		'alice',
		'bob',
		'charlie',
		'dana',
		'eve',
		'frank',
		'grace',
		'heidi',
		'ivan',
		'judy',
		'kim',
		'leo',
		'mallory'
	];

	const host = env.PUBLIC_OBP_BASE_URL ?? '(unset)';

	const sizes = [24, 40, 64, 96];
	let selectedSize = $state(64);
	let selectedGrid = $state(5);
</script>

<svelte:head>
	<title>Avatar preview</title>
</svelte:head>

<div class="space-y-8 p-6">
	<header>
		<h1 class="text-2xl font-bold">Avatar preview</h1>
		<p class="text-sm text-surface-600-400 mt-1">
			Deterministic pixel-art identicons. Seed = <code>OBP_BASE_URL|username</code>, so the
			same username on a different OBP instance produces a different avatar.
		</p>
		<p class="text-xs text-surface-500 mt-1">
			Host: <code>{host}</code>
		</p>
	</header>

	<section class="flex flex-wrap items-center gap-6">
		<label class="flex items-center gap-2 text-sm">
			Size:
			<select bind:value={selectedSize} class="select rounded border border-surface-300-600 px-2 py-1">
				{#each sizes as s}
					<option value={s}>{s}px</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 text-sm">
			Grid:
			<select bind:value={selectedGrid} class="select rounded border border-surface-300-600 px-2 py-1">
				{#each [5, 6, 7, 8, 10] as g}
					<option value={g}>{g}×{g}</option>
				{/each}
			</select>
		</label>
	</section>

	<section>
		<h2 class="mb-3 text-lg font-semibold">Sample usernames</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
			{#each usernames as username (username)}
				<div class="flex items-center gap-3 rounded-lg border border-surface-300-600 bg-surface-50-900 p-3">
					<Avatar seed={userAvatarSeed(username)} size={selectedSize} gridSize={selectedGrid} title="Avatar for {username}" />
					<code class="truncate text-xs text-surface-600-400" title={username}>{username}</code>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="mb-3 text-lg font-semibold">Inline use (chat-message style)</h2>
		<div class="space-y-3">
			{#each usernames.slice(0, 6) as username (username)}
				<div class="flex items-start gap-3 rounded-lg border border-surface-300-600 bg-surface-50-900 p-3">
					<Avatar seed={userAvatarSeed(username)} size={32} gridSize={selectedGrid} title="Avatar for {username}" />
					<div class="flex-1">
						<p class="text-sm font-semibold">{username}</p>
						<p class="text-sm text-surface-600-400">
							Lorem ipsum dolor sit amet, consectetur adipiscing elit.
						</p>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
