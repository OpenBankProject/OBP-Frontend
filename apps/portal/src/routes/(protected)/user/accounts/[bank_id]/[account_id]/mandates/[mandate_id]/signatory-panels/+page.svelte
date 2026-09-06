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
	let { data } = $props();

	const base = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/mandates/${encodeURIComponent(data.mandate_id)}/signatory-panels`;
	const mandatesHref = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/mandates`;
	const createHref = `${base}/create`;

	function panelHref(panel_id: string): string {
		return `${base}/${encodeURIComponent(panel_id)}`;
	}
</script>

<div class="mb-4">
	<a
		class="text-sm text-primary-500 hover:underline dark:text-primary-200"
		href={mandatesHref}
		data-testid="back-to-mandates"
	>← Mandates</a>
</div>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h2 class="text-2xl font-semibold">Signatory panels</h2>
		<p class="mt-1 text-sm text-surface-700-300">
			Named groups of authorised signers. Mandate provisions reference these panels to define signing rules.
		</p>
	</div>
	<a class="btn variant-filled-primary" href={createHref} data-testid="create-panel-link">+ New panel</a>
</div>

<p class="mb-4 text-xs text-surface-600-400">
	Mandate <code data-testid="panels-mandate-id">{data.mandate_id}</code>
</p>

{#if data.fetchError}
	<div class="alert variant-filled-error mb-4" data-testid="panels-fetch-error">
		<p>Failed to load signatory panels: {data.fetchError}</p>
	</div>
{/if}

{#if data.panels.length === 0 && !data.fetchError}
	<p class="text-surface-600-400" data-testid="panels-empty">No signatory panels on this mandate yet.</p>
{:else if data.panels.length > 0}
	<div class="table-container" data-testid="panels-table">
		<table class="table-hover table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Description</th>
					<th class="text-right">Members</th>
				</tr>
			</thead>
			<tbody>
				{#each data.panels as p (p.panel_id)}
					<tr data-testid="panel-row" data-panel-id={p.panel_id}>
						<td>
							<a
								class="font-medium text-primary-500 hover:underline dark:text-primary-200"
								href={panelHref(p.panel_id)}
								data-testid="panel-link"
							>{p.panel_name}</a>
						</td>
						<td>{p.description}</td>
						<td class="text-right" data-testid="panel-member-count">{p.user_ids.length}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
