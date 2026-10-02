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
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	/**
	 * A main panel with a side panel on the right (e.g. Opey) and a vertical divider between
	 * them that can be dragged, or moved with the arrow keys once focused. Double-click resets.
	 * Below the breakpoint the panels stack and there is no divider. The width is remembered
	 * in this browser under `storageKey`, so every page using the same key opens at the same width.
	 */
	let {
		main,
		side,
		breakpoint = 'lg',
		defaultSideWidth = 320,
		minSideWidth = 256,
		maxSideFraction = 0.6,
		storageKey = 'obp-side-panel-width',
		sideTestid = 'opey-form-pane'
	}: {
		main: Snippet;
		side: Snippet;
		breakpoint?: 'lg' | 'xl';
		defaultSideWidth?: number;
		minSideWidth?: number;
		maxSideFraction?: number;
		storageKey?: string;
		sideTestid?: string;
	} = $props();

	const KEY_STEP = 32;

	let container = $state<HTMLDivElement>();
	// svelte-ignore state_referenced_locally
	let sideWidth = $state(defaultSideWidth);
	let dragging = $state(false);

	function clamp(width: number): number {
		const max = container ? container.clientWidth * maxSideFraction : Infinity;
		return Math.round(Math.max(minSideWidth, Math.min(width, max)));
	}

	function save() {
		try {
			localStorage.setItem(storageKey, String(sideWidth));
		} catch {
			// storage unavailable (private window, blocked site data): the width just is not remembered
		}
	}

	onMount(() => {
		try {
			const stored = Number(localStorage.getItem(storageKey));
			if (stored > 0) sideWidth = clamp(stored);
		} catch {
			// keep the default
		}
	});

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragging = true;
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || !container) return;
		sideWidth = clamp(container.getBoundingClientRect().right - event.clientX);
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging) return;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		dragging = false;
		save();
	}

	function onKeyDown(event: KeyboardEvent) {
		// The side panel is on the right: ArrowLeft widens it, ArrowRight narrows it
		const delta = event.key === 'ArrowLeft' ? KEY_STEP : event.key === 'ArrowRight' ? -KEY_STEP : 0;
		if (event.key === 'Home') sideWidth = clamp(Infinity);
		else if (event.key === 'End') sideWidth = clamp(0);
		else if (delta) sideWidth = clamp(sideWidth + delta);
		else return;
		event.preventDefault();
		save();
	}

	function reset() {
		sideWidth = clamp(defaultSideWidth);
		save();
	}
</script>

<div
	bind:this={container}
	class="split split-{breakpoint}"
	style="--side-width: {sideWidth}px"
	data-state={dragging ? 'dragging' : 'idle'}
	data-testid="resizable-split"
>
	<div class="split-main">
		{@render main()}
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="split-handle"
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize side panel"
		aria-valuenow={sideWidth}
		aria-valuemin={minSideWidth}
		tabindex="0"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onKeyDown}
		ondblclick={reset}
		data-testid="resizable-split-handle"
	></div>
	<aside class="split-side" data-testid={sideTestid}>
		{@render side()}
	</aside>
</div>

<style>
	.split {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.split-main {
		min-width: 0;
	}

	.split-handle {
		display: none;
	}

	@media (min-width: 1024px) {
		.split-lg {
			flex-direction: row;
			gap: 0;
		}
		.split-lg .split-main {
			flex: 1 1 0;
		}
		.split-lg .split-handle {
			display: block;
		}
		.split-lg .split-side {
			flex: 0 0 var(--side-width);
			width: var(--side-width);
			position: sticky;
			top: 2rem;
			align-self: flex-start;
		}
	}

	@media (min-width: 1280px) {
		.split-xl {
			flex-direction: row;
			gap: 0;
		}
		.split-xl .split-main {
			flex: 1 1 0;
		}
		.split-xl .split-handle {
			display: block;
		}
		.split-xl .split-side {
			flex: 0 0 var(--side-width);
			width: var(--side-width);
			position: sticky;
			top: 2rem;
			align-self: flex-start;
		}
	}

	/* A 1.5rem gutter you can grab, with a thin line in the middle */
	.split-handle {
		position: relative;
		flex: 0 0 1.5rem;
		align-self: stretch;
		cursor: col-resize;
		touch-action: none;
	}

	.split-handle::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		border-radius: 1px;
		background: rgb(229 231 235);
		transition: background 0.15s;
	}

	.split-handle:hover::after,
	.split-handle:focus-visible::after,
	.split[data-state='dragging'] .split-handle::after {
		background: rgb(59 130 246);
	}

	.split-handle:focus-visible {
		outline: 2px solid rgb(59 130 246);
		outline-offset: 2px;
	}

	:global([data-mode='dark']) .split-handle::after {
		background: rgb(55 65 81);
	}

	:global([data-mode='dark']) .split-handle:hover::after,
	:global([data-mode='dark']) .split-handle:focus-visible::after,
	:global([data-mode='dark']) .split[data-state='dragging'] .split-handle::after {
		background: rgb(96 165 250);
	}
</style>
