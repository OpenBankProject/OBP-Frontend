<script lang="ts">
	import { generateIdenticon } from './generate';

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
