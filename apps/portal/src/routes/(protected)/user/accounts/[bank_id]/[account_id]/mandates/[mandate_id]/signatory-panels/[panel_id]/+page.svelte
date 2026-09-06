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
	let { data, form } = $props();

	let panel_name = $state<string>(data.panel?.panel_name ?? '');
	let description = $state<string>(data.panel?.description ?? '');
	let user_ids = $state<string[]>([...(data.panel?.user_ids ?? [])]);
	let nextUserId = $state<string>('');

	const panelsHref = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/mandates/${encodeURIComponent(data.mandate_id)}/signatory-panels`;

	function addUser() {
		const v = nextUserId.trim();
		if (!v) return;
		if (user_ids.includes(v)) {
			nextUserId = '';
			return;
		}
		user_ids = [...user_ids, v];
		nextUserId = '';
	}

	function removeUser(id: string) {
		user_ids = user_ids.filter((u) => u !== id);
	}

	function onUserIdKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addUser();
		}
	}

	function confirmDelete(e: SubmitEvent) {
		const ok = confirm(
			'Delete this signatory panel? Mandate provisions referencing it may stop validating.'
		);
		if (!ok) e.preventDefault();
	}
</script>

<div class="mb-4">
	<a
		class="text-sm text-primary-500 hover:underline dark:text-primary-200"
		href={panelsHref}
		data-testid="back-to-panels"
	>← Signatory panels</a>
</div>

{#if data.fetchError}
	<div class="alert variant-filled-error mb-4" data-testid="panel-fetch-error">
		<p>Failed to load panel: {data.fetchError}</p>
	</div>
{/if}

{#if data.panel}
	<h2 class="mb-1 text-2xl font-semibold" data-testid="panel-heading">
		{data.panel.panel_name}
	</h2>
	<p class="mb-4 text-xs text-surface-600-400">
		Panel <code data-testid="panel-id">{data.panel.panel_id}</code>
	</p>

	{#if form?.formError}
		<div class="alert variant-filled-error mb-4" data-testid="panel-form-error">
			<p>{form.formError}</p>
		</div>
	{/if}

	{#if form?.success}
		<div class="alert variant-filled-success mb-4" data-testid="panel-update-success">
			<p>{form.message ?? 'Saved.'}</p>
		</div>
	{/if}

	<form method="POST" action="?/update" class="space-y-4" data-testid="edit-panel-form">
		<label class="label">
			<span>Panel name</span>
			<input
				class="input"
				name="panel_name"
				type="text"
				required
				bind:value={panel_name}
				data-testid="panel-name-input"
			/>
		</label>

		<label class="label">
			<span>Description</span>
			<textarea
				class="textarea"
				name="description"
				rows="3"
				bind:value={description}
				data-testid="panel-description-input"
			></textarea>
		</label>

		<fieldset class="space-y-2">
			<legend class="label-text">Members (user IDs)</legend>

			<div class="flex gap-2">
				<input
					class="input flex-1"
					type="text"
					bind:value={nextUserId}
					onkeydown={onUserIdKeydown}
					placeholder="Paste a user_id and press Add"
					data-testid="user-id-input"
				/>
				<button
					type="button"
					class="btn variant-soft-primary"
					onclick={addUser}
					data-testid="add-user-id"
				>Add</button>
			</div>

			{#if user_ids.length === 0}
				<p class="text-sm text-surface-600-400" data-testid="user-ids-empty">
					No members.
				</p>
			{:else}
				<ul class="flex flex-wrap gap-2" data-testid="user-ids-list">
					{#each user_ids as id (id)}
						<li
							class="chip variant-soft-surface flex items-center gap-2"
							data-testid="user-id-chip"
							data-user-id={id}
						>
							<code class="text-xs">{id}</code>
							<button
								type="button"
								class="btn-icon btn-icon-sm"
								aria-label={`Remove ${id}`}
								onclick={() => removeUser(id)}
								data-testid="remove-user-id"
							>×</button>
							<input type="hidden" name="user_ids" value={id} />
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>

		<div class="flex gap-2">
			<button
				class="btn variant-filled-primary"
				type="submit"
				data-testid="submit-update-panel"
			>Save changes</button>
			<a
				class="btn variant-soft-surface"
				href={panelsHref}
				data-testid="cancel-edit-panel"
			>Cancel</a>
		</div>
	</form>

	<hr class="my-8" />

	<form
		method="POST"
		action="?/delete"
		onsubmit={confirmDelete}
		data-testid="delete-panel-form"
	>
		<button
			class="btn variant-filled-error"
			type="submit"
			data-testid="delete-panel"
		>Delete panel</button>
	</form>
{/if}
