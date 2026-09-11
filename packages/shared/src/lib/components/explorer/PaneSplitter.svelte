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
	/**
	 * A draggable divider between two panes, sized as a percentage of its parent.
	 *
	 * Keyboard-operable on purpose: a mouse-only splitter would leave the pane widths
	 * unreachable for anyone navigating by keyboard, and the focus ring is left intact.
	 */
	interface Props {
		/** Percentage of the container occupied by the pane before this splitter. */
		value: number;
		min?: number;
		max?: number;
		label: string;
		/** Measure from the right edge instead of the left. */
		fromEnd?: boolean;
		/**
		 * What `value` means. 'parent-percent' is a share of the splitter's flex container,
		 * for panes sitting side by side. 'viewport-px' is an absolute width measured from
		 * the window edge, which is what a sidebar in an `auto` grid column needs — there
		 * is no percentage of a column that sizes itself to its content.
		 */
		basis?: 'parent-percent' | 'viewport-px';
	}

	let {
		value = $bindable(),
		min = 10,
		max = 60,
		label,
		fromEnd = false,
		basis = 'parent-percent'
	}: Props = $props();

	let element: HTMLDivElement;
	let dragging = $state(false);

	function clamp(next: number): number {
		return Math.min(max, Math.max(min, next));
	}

	function setFromClientX(clientX: number) {
		if (basis === 'viewport-px') {
			value = clamp(fromEnd ? window.innerWidth - clientX : clientX);
			return;
		}
		const rect = element.parentElement?.getBoundingClientRect();
		if (!rect || rect.width === 0) return;
		const fraction = fromEnd ? (rect.right - clientX) / rect.width : (clientX - rect.left) / rect.width;
		value = clamp(fraction * 100);
	}

	function onpointerdown(event: PointerEvent) {
		dragging = true;
		element.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (dragging) setFromClientX(event.clientX);
	}

	function onpointerup(event: PointerEvent) {
		dragging = false;
		element.releasePointerCapture(event.pointerId);
	}

	function onkeydown(event: KeyboardEvent) {
		const coarse = basis === 'viewport-px';
		const step = event.shiftKey ? (coarse ? 64 : 10) : coarse ? 16 : 2;
		const towardsStart = fromEnd ? 'ArrowRight' : 'ArrowLeft';
		const towardsEnd = fromEnd ? 'ArrowLeft' : 'ArrowRight';
		if (event.key === towardsStart) value = clamp(value - step);
		else if (event.key === towardsEnd) value = clamp(value + step);
		else if (event.key === 'Home') value = min;
		else if (event.key === 'End') value = max;
		else return;
		event.preventDefault();
	}
</script>

<!--
  A focusable separator is the ARIA window-splitter pattern: role="separator" with a
  tabindex and arrow keys is exactly how a resizable divider is meant to be exposed, so
  the "non-interactive element" rules do not apply to it here.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={element}
	class="w-1 shrink-0 cursor-col-resize bg-surface-300-600 hover:bg-primary-500 {dragging
		? 'bg-primary-500'
		: ''}"
	role="separator"
	aria-orientation="vertical"
	aria-label={label}
	aria-valuenow={Math.round(value)}
	aria-valuemin={min}
	aria-valuemax={max}
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onkeydown}
></div>
