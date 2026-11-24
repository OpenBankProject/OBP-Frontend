<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	/**
	 * A translated message with a little markup, such as "{#strong}Participants{/strong}: banks…". Pass the message's parts,
	 * for example `m.conformator_home_who_participants.parts()`. Only strong, em and code become tags. Any other tag must
	 * be in `links`: it becomes a link to that address, so the addresses stay in the code, not in the message files.
	 * The text is never read as HTML.
	 */
	import type { MessagePart } from '$shared/paraglide/runtime.js';

	type Node = { type: 'text'; value: string } | { type: 'tag'; name: string; children: Node[] };

	let { parts, links = {} }: { parts: MessagePart[]; links?: Record<string, string> } = $props();

	// The tags drawn as they are
	const STYLE_TAGS = ['strong', 'em', 'code'];

	/** Turns the flat list of parts into a tree, so a tag holds the text inside it. */
	function toTree(list: MessagePart[]): Node[] {
		const root: Node[] = [];
		const open: Node[][] = [root];
		for (const part of list) {
			const children = open[open.length - 1];
			if (part.type === 'text') {
				children.push({ type: 'text', value: part.value });
			} else if (part.type === 'markup-start') {
				const node: Node = { type: 'tag', name: part.name, children: [] };
				children.push(node);
				open.push(node.children);
			} else if (part.type === 'markup-end' && open.length > 1) {
				open.pop();
			}
		}
		return root;
	}

	const nodes = $derived(toTree(parts));
</script>

{#snippet draw(list: Node[])}{#each list as node, i (i)}{#if node.type === 'text'}{node.value}{:else if STYLE_TAGS.includes(node.name)}<svelte:element this={node.name}>{@render draw(node.children)}</svelte:element>{:else if links[node.name]}<a class="anchor" href={links[node.name]}>{@render draw(node.children)}</a>{:else}{@render draw(node.children)}{/if}{/each}{/snippet}{@render draw(nodes)}
