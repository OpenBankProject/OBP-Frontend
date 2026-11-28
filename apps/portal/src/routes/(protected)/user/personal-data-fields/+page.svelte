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
	import type { OBPPersonalDataField } from '$lib/obp/types';

	type FormFail = {
		action?: string;
		success?: boolean;
		message?: string;
		editId?: string;
		name?: string;
		type?: string;
		value?: string;
	};

	const { data, form } = $props();
	const initialForm = form as FormFail | null | undefined;
	const formFail = $derived(form as FormFail | null | undefined);

	const typeOptions: OBPPersonalDataField['type'][] = ['STRING', 'INTEGER', 'DOUBLE', 'DATE_WITH_DAY'];

	let editingId = $state<string | null>(initialForm?.editId ?? null);
	let editName = $state('');
	let editType = $state<OBPPersonalDataField['type']>('STRING');
	let editValue = $state('');

	function startEdit(field: OBPPersonalDataField) {
		editingId = field.user_attribute_id;
		editName = field.name;
		editType = field.type;
		editValue = field.value;
	}

	function cancelEdit() {
		editingId = null;
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return date.toLocaleString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				hourCycle: 'h23',
				minute: '2-digit'
			});
		} catch {
			return 'Unknown date';
		}
	}

	// Reset edit state on successful action
	if (form?.success) {
		editingId = null;
	}
</script>

<h2 class="mb-4 text-xl font-semibold">Personal Data Fields</h2>

<p class="mb-4 ui-muted">
	Manage your personal data attributes. These are key-value pairs you can use to store personal information.
</p>

{#if data.loadError}
	<div class="mb-4 rounded-lg border p-4 ui-tone-error">
		<p class="text-sm ui-text-error">{data.loadError}</p>
	</div>
{/if}

{#if form?.success}
	<div class="mb-4 rounded-lg border p-4 ui-tone-success">
		<p class="text-sm ui-text-success">{form.message}</p>
	</div>
{/if}

{#if form?.message && form?.action !== 'create'}
	<div class="mb-4 rounded-lg border p-4 ui-tone-error">
		<p class="text-sm ui-text-error">{form.message}</p>
	</div>
{/if}

{#if data.fields.length > 0}
	<div class="table-container mb-8">
		<table class="table-hover table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Type</th>
					<th>Value</th>
					<th>Date Added</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.fields as field (field.user_attribute_id)}
					{#if editingId === field.user_attribute_id}
						<tr>
							<td colspan="5">
								<form method="POST" action="?/update" class="flex flex-wrap items-end gap-2">
									<input type="hidden" name="user_attribute_id" value={field.user_attribute_id} />
									<div>
										<label class="text-xs font-medium ui-muted" for="edit-name">Name</label>
										<input
											id="edit-name"
											class="input"
											type="text"
											name="name"
											bind:value={editName}
											required
										/>
									</div>
									<div>
										<label class="text-xs font-medium ui-muted" for="edit-type">Type</label>
										<select id="edit-type" class="select" name="type" bind:value={editType}>
											{#each typeOptions as t}
												<option value={t}>{t}</option>
											{/each}
										</select>
									</div>
									<div>
										<label class="text-xs font-medium ui-muted" for="edit-value">Value</label>
										<input
											id="edit-value"
											class="input"
											type="text"
											name="value"
											bind:value={editValue}
											required
										/>
									</div>
									<div class="flex gap-2">
										<button type="submit" class="btn preset-outlined-surface-500">Save</button>
										<button type="button" class="btn preset-outlined-surface-500" onclick={cancelEdit}>Cancel</button>
									</div>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td>{field.name}</td>
							<td>{field.type}</td>
							<td>{field.value}</td>
							<td>{formatDate(field.insert_date)}</td>
							<td>
								<div class="flex gap-2">
									<button
										type="button"
										class="btn btn-sm preset-outlined-surface-500"
										onclick={() => startEdit(field)}
									>
										Edit
									</button>
									<form method="POST" action="?/delete" class="inline">
										<input type="hidden" name="user_attribute_id" value={field.user_attribute_id} />
										<button type="submit" class="btn btn-sm preset-filled-error-500">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{:else if !data.loadError}
	<div class="mb-8 rounded-lg p-8 text-center ui-panel">
		<p class="mb-2 text-lg font-medium ui-muted">No personal data fields found</p>
		<p class="ui-muted">
			Use the form below to add your first personal data field.
		</p>
	</div>
{/if}

<h2 class="mt-8 mb-4 text-xl font-semibold">Add New Field</h2>

{#if form?.message && form?.action === 'create'}
	<div class="mb-4 rounded-lg border p-4 ui-tone-error">
		<p class="text-sm ui-text-error">{form.message}</p>
	</div>
{/if}

<form method="POST" action="?/create" class="mx-auto w-full max-w-md space-y-4">
	<label class="label">
		<span class="label-text">Name</span>
		<input
			class="input"
			type="text"
			name="name"
			placeholder="e.g. favorite_color"
			value={formFail?.action === 'create' && !formFail?.success ? (formFail?.name ?? '') : ''}
			required
		/>
	</label>

	<label class="label">
		<span class="label-text">Type</span>
		<select class="select" name="type" value={formFail?.action === 'create' && !formFail?.success ? (formFail?.type ?? 'STRING') : 'STRING'}>
			{#each typeOptions as t}
				<option value={t}>{t}</option>
			{/each}
		</select>
	</label>

	<label class="label">
		<span class="label-text">Value</span>
		<input
			class="input"
			type="text"
			name="value"
			placeholder="e.g. blue"
			value={formFail?.action === 'create' && !formFail?.success ? (formFail?.value ?? '') : ''}
			required
		/>
	</label>

	<button class="btn preset-outlined-surface-500" type="submit">Add Field</button>
</form>
