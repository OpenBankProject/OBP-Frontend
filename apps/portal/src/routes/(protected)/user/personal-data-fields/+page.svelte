<script lang="ts">
	import type { OBPPersonalDataField } from '$lib/obp/types';

	const { data, form } = $props();

	const typeOptions: OBPPersonalDataField['type'][] = ['STRING', 'INTEGER', 'DOUBLE', 'DATE_WITH_DAY'];

	let editingId = $state<string | null>(form?.editId ?? null);
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

<p class="mb-4 text-gray-700 dark:text-gray-300">
	Manage your personal data attributes. These are key-value pairs you can use to store personal information.
</p>

{#if data.loadError}
	<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
		<p class="text-sm text-red-800 dark:text-red-200">{data.loadError}</p>
	</div>
{/if}

{#if form?.success}
	<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
		<p class="text-sm text-green-800 dark:text-green-200">{form.message}</p>
	</div>
{/if}

{#if form?.error && form?.action !== 'create'}
	<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
		<p class="text-sm text-red-800 dark:text-red-200">{form.error}</p>
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
										<label class="text-xs font-medium text-gray-600 dark:text-gray-400" for="edit-name">Name</label>
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
										<label class="text-xs font-medium text-gray-600 dark:text-gray-400" for="edit-type">Type</label>
										<select id="edit-type" class="select" name="type" bind:value={editType}>
											{#each typeOptions as t}
												<option value={t}>{t}</option>
											{/each}
										</select>
									</div>
									<div>
										<label class="text-xs font-medium text-gray-600 dark:text-gray-400" for="edit-value">Value</label>
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
										<button type="submit" class="btn preset-outlined-success-500">Save</button>
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
										class="btn btn-sm preset-outlined-primary-500"
										onclick={() => startEdit(field)}
									>
										Edit
									</button>
									<form method="POST" action="?/delete" class="inline">
										<input type="hidden" name="user_attribute_id" value={field.user_attribute_id} />
										<button type="submit" class="btn btn-sm preset-outlined-error-500">Delete</button>
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
	<div class="mb-8 rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
		<p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">No personal data fields found</p>
		<p class="text-gray-600 dark:text-gray-400">
			Use the form below to add your first personal data field.
		</p>
	</div>
{/if}

<h2 class="mt-8 mb-4 text-xl font-semibold">Add New Field</h2>

{#if form?.error && form?.action === 'create'}
	<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
		<p class="text-sm text-red-800 dark:text-red-200">{form.error}</p>
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
			value={form?.action === 'create' && !form?.success ? (form?.name ?? '') : ''}
			required
		/>
	</label>

	<label class="label">
		<span class="label-text">Type</span>
		<select class="select" name="type" value={form?.action === 'create' && !form?.success ? (form?.type ?? 'STRING') : 'STRING'}>
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
			value={form?.action === 'create' && !form?.success ? (form?.value ?? '') : ''}
			required
		/>
	</label>

	<button class="btn preset-outlined-tertiary-500" type="submit">Add Field</button>
</form>
