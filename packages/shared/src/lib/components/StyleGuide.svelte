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
	// The theme's colours and every named style of packages/shared/styles.css, for whoever writes or checks a theme (docs/branding.md). Pages use only these styles.
	let { theme }: { theme: string } = $props();

	const ROLES = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error', 'surface'];
	const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
	const TEXT = [
		{ cls: 'ui-text', use: 'Strong text, such as headings and values' },
		{ cls: 'ui-muted', use: 'Secondary text: labels, dates, hints' },
		{ cls: 'ui-text-brand', use: 'Text in the brand colour' },
		{ cls: 'ui-link', use: 'Links and link-like actions' },
		{ cls: 'ui-text-success', use: 'Worked, active' },
		{ cls: 'ui-text-warning', use: 'Needs attention' },
		{ cls: 'ui-text-error', use: 'Failed, refused, form errors' }
	];
	const TONES = [
		{ cls: 'ui-tone-success', text: 'Saved. The change takes effect at once.' },
		{ cls: 'ui-tone-warning', text: 'This Consumer has no Scopes yet.' },
		{ cls: 'ui-tone-error', text: 'OBP-API refused the request.' },
		{ cls: 'ui-tone-info', text: 'Sandbox data is reset every night.' },
		{ cls: 'ui-tone-accent', text: 'A category or tier.' },
		{ cls: 'ui-tone-neutral', text: 'Neutral, such as a plain status.' }
	];
	const BUTTONS = [
		{ cls: 'preset-filled-primary-500', label: 'Main' },
		{ cls: 'preset-tonal', label: 'Secondary' },
		{ cls: 'preset-outlined-surface-500', label: 'Outline' },
		{ cls: 'preset-filled-error-500', label: 'Danger' }
	];
</script>

<div class="space-y-10" data-testid="style-guide">
	<header>
		<h1 class="h2">Style guide</h1>
		<p class="mt-2">Theme: <code data-testid="style-guide-theme">{theme}</code>. These are all the colour styles the apps use. Switch between light and dark mode to check both.</p>
	</header>

	<section data-testid="style-guide-text">
		<h2 class="h4">Text</h2>
		<p class="h3 mt-3">Heading</p>
		<p>Body text, with <a class="anchor" href="#style-guide">a link</a> and <code>code</code>.</p>
		<dl class="mt-3 grid max-w-3xl grid-cols-[auto_1fr] gap-x-6 gap-y-1">
			{#each TEXT as item (item.cls)}<dt class={item.cls}><code>{item.cls}</code></dt><dd class={item.cls}>{item.use}</dd>{/each}
		</dl>
	</section>

	<section data-testid="style-guide-surfaces">
		<h2 class="h4">Backgrounds and borders</h2>
		<div class="mt-3 max-w-3xl rounded-container border p-4 ui-page ui-border"><code>ui-page</code>: the page itself, and the side menu.</div>
		<div class="mt-3 max-w-3xl rounded-container border p-4 ui-card ui-border">
			<code>ui-card ui-border</code>: a card on the page.
			<div class="mt-3 rounded-base p-3 ui-panel"><code>ui-panel</code>: a panel inside it.</div>
			<ul class="mt-3 divide-y ui-border">
				<li class="p-2 ui-hover"><code>ui-hover</code>: a row that highlights under the mouse</li>
				<li class="p-2 ui-hover">A second row, divided by <code>ui-border</code></li>
				<li class="border-s-4 p-2 ui-border-brand"><code>ui-border-brand</code>: the marker on a selected item</li>
			</ul>
			<div class="relative mt-3 h-16 overflow-hidden"><p>A long card cut off at the foot …</p><div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 ui-fade"></div></div>
			<p class="ui-muted"><code>ui-fade</code> above; <code>ui-glow</code> is the dark-mode background behind the Portal.</p>
		</div>
	</section>

	<section data-testid="style-guide-items">
		<h2 class="h4">Item text: a list of items</h2>
		<div class="mt-3 max-w-3xl rounded-container border p-4 ui-card ui-border">
			<p class="ui-summary"><span class="ui-highlight">alice</span> <span class="ui-muted">has requested</span> <span class="ui-highlight">CanCreateAccount</span> <span class="ui-muted">at</span> <span class="ui-highlight">gh.29.uk</span></p>
			<p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 ui-details"><span>alice@example.com</span><a class="ui-link" href="#style-guide-items">User Details</a><span>28/11/2026 09:12</span><span>5f3a9c1e-2b7d-4e0a-9c55-1d2e3f4a5b6c</span></p>
		</div>
		<p class="mt-2 ui-muted"><code>ui-summary</code>: the line people read first. <code>ui-highlight</code>: the values in it they always look for. <code>ui-details</code>: dates, IDs and links, looked at now and then. Links inside keep <code>ui-link</code> and take the details' size.</p>
	</section>

	<section data-testid="style-guide-tones">
		<h2 class="h4">Tones: badges, messages and highlighted boxes</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each TONES as tone (tone.cls)}<span class="rounded-full border px-2 py-0.5 text-xs font-medium {tone.cls}">{tone.cls.replace('ui-tone-', '')}</span>{/each}
		</div>
		<div class="mt-3 max-w-3xl space-y-2">
			{#each TONES as tone (tone.cls)}<p class="rounded-base border p-3 {tone.cls}"><code>{tone.cls}</code>: {tone.text}</p>{/each}
		</div>
	</section>

	<section data-testid="style-guide-buttons">
		<h2 class="h4">Buttons</h2>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each BUTTONS as button (button.cls)}<button type="button" class="btn {button.cls}">{button.label}</button>{/each}
		</div>
		<p class="mt-2 ui-muted">{BUTTONS.map((button) => button.cls).join(', ')}</p>
	</section>

	<section data-testid="style-guide-form">
		<h2 class="h4">Form and table</h2>
		<form class="mt-3 grid max-w-md gap-3" onsubmit={(event) => event.preventDefault()}>
			<label class="label"><span class="label-text">Name</span><input class="input" name="name" placeholder="Example Bank" /></label>
			<label class="label"><span class="label-text">Type</span><select class="select" name="type"><option>Bank</option><option>Fintech</option></select></label>
			<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="agree" checked /> I agree</label>
			<p class="text-sm ui-text-error">A form error looks like this.</p>
		</form>
		<table class="table mt-3 max-w-2xl">
			<thead><tr><th>Consumer</th><th>Status</th></tr></thead>
			<tbody>
				<tr><td>Example App</td><td class="ui-text-success">Enabled</td></tr>
				<tr><td>Test Client</td><td class="ui-muted">Disabled</td></tr>
			</tbody>
		</table>
	</section>

	<section data-testid="style-guide-charts">
		<h2 class="h4">Chart series</h2>
		<p class="mt-2 ui-muted">In page CSS: <code>var(--ui-chart-1)</code> to <code>var(--ui-chart-8)</code>.</p>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each [1, 2, 3, 4, 5, 6, 7, 8] as series (series)}
				<span class="inline-flex h-10 w-16 items-center justify-center rounded-base text-sm font-semibold" style="background: var(--ui-chart-{series}); color: var(--ui-chart-label)">{series}</span>
			{/each}
		</div>
	</section>

	<section data-testid="style-guide-colours">
		<h2 class="h4">The theme's colours</h2>
		<p class="mt-2 max-w-3xl ui-muted">The styles above are made from these scales. A theme sets them; pages never use them directly.</p>
		<div class="mt-3 space-y-2">
			{#each ROLES as role (role)}
				<div>
					<p class="text-sm"><strong>{role}</strong></p>
					<div class="mt-1 grid grid-cols-11 gap-1">
						{#each SHADES as shade (shade)}
							<div class="rounded-base p-1 text-center text-xs" style="background: var(--color-{role}-{shade}); color: var(--color-{role}-contrast-{shade})">{shade}</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
