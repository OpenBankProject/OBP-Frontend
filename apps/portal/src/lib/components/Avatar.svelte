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
	import { generateIdenticon } from '$lib/avatar/generate';

	interface Props {
		seed: string;
		size?: number;
		gridSize?: number;
		title?: string;
		shape?: 'square' | 'circle';
	}

	let { seed, size = 40, gridSize = 5, title, shape = 'square' }: Props = $props();

	const identicon = $derived(generateIdenticon(seed, gridSize));
	const cellSize = $derived(size / gridSize);
	const radius = $derived(shape === 'circle' ? size / 2 : size * 0.15);
	const clipStyle = $derived(shape === 'circle' ? 'clip-path: circle(50%);' : '');
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	role="img"
	aria-label={title ?? `Avatar for ${seed}`}
	data-testid="avatar"
	data-seed={seed}
	data-shape={shape}
	style={clipStyle}
>
	<rect width={size} height={size} rx={radius} ry={radius} fill={identicon.background} />
	{#each identicon.grid as row, y}
		{#each row as filled, x}
			{#if filled}
				<rect
					x={x * cellSize}
					y={y * cellSize}
					width={cellSize}
					height={cellSize}
					fill={identicon.color}
				/>
			{/if}
		{/each}
	{/each}
</svg>
