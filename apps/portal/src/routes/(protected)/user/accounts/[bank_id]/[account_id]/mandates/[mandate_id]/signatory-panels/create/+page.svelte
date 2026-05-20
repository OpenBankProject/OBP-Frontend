<script lang="ts">
	let { data, form } = $props();

	let panel_name = $state<string>((form?.panel_name as string) ?? '');
	let description = $state<string>((form?.description as string) ?? '');
	let user_ids = $state<string[]>((form?.user_ids as string[]) ?? []);
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
</script>

<div class="mb-4">
	<a
		class="text-sm text-primary-500 hover:underline dark:text-primary-200"
		href={panelsHref}
		data-testid="back-to-panels"
	>← Signatory panels</a>
</div>

<h2 class="mb-4 text-2xl font-semibold">New signatory panel</h2>

{#if form?.formError}
	<div class="alert variant-filled-error mb-4" data-testid="create-panel-error">
		<p>{form.formError}</p>
	</div>
{/if}

<form method="POST" class="space-y-4" data-testid="create-panel-form">
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
				No members added yet.
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
			data-testid="submit-create-panel"
		>Create panel</button>
		<a
			class="btn variant-soft-surface"
			href={panelsHref}
			data-testid="cancel-create-panel"
		>Cancel</a>
	</div>
</form>
