<script lang="ts">
	const { data, form } = $props();
	const userEntitlements = data.userEntitlements;
	const allEntitlements = data.allAvailableEntitlements;
	const allBanks = data.allBanks;

	const canCreateEntitlements = userEntitlements.some((entitlement) =>
			['CanCreateEntitlementAtAnyBank', 'CanCreateEntitlementAtOneBank'].includes(
				entitlement.role_name
			)
		);

	let selectedEntitlementRole = $state('');
	let selectedBankId = $state('');

	// Derived state to get the full entitlement object
	let selectedEntitlement = $derived(
		allEntitlements.find((ent) => ent.role === selectedEntitlementRole) || { role: '', requires_bank_id: false }
	);

	// Pre-select entitlement if form data exists (on validation errors)
	if (form?.entitlement && !form?.success) {
		selectedEntitlementRole = String(form.entitlement);
	}

	if (form?.bank_id && !form?.success) {
		selectedBankId = String(form.bank_id);
	}

	// Reset form on success
	if (form?.success) {
		selectedEntitlementRole = '';
		selectedBankId = '';
	}

	// console.debug('User Entitlements:', userEntitlements);
	// console.debug('All Entitlements:', allEntitlements);
	console.log('Can Create Entitlements:', canCreateEntitlements);
</script>

<h2 class="mb-4 text-xl font-semibold">Your Entitlements</h2>

{#if userEntitlements.length > 0}
	<div class="table-container">
		<!-- Native Table Element -->
		<table class="table-hover table">
			<thead>
				<tr>
					<th>Name</th>
					<th>ID</th>
					<th>Bank ID</th>
				</tr>
			</thead>
			<tbody>
				{#each userEntitlements as row, i}
					<tr>
						<td>{row.role_name}</td>
						<td>{row.entitlement_id}</td>
						<td>{row.bank_id}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if canCreateEntitlements}
	<h2 class="mt-8 mb-4 text-xl font-semibold">Add New Entitlement</h2>

	{#if form?.success}
		<div class="alert variant-filled-success mb-4">
			<p>{form.message}</p>
		</div>
	{/if}

	<form method="POST" action="?/create" class="mx-auto w-full max-w-md space-y-4">
		<label class="label">
			<span class="label-text">Select Entitlement</span>
			<select class="select" name="entitlement" bind:value={selectedEntitlementRole}>
				<option value="" disabled>Select an entitlement</option>
				{#each allEntitlements as ent}
					<option value={ent.role}>{ent.role}</option>
				{/each}
			</select>
		</label>

		{#if form?.missing}<p class="text-error-500 text-xs">Please select an entitlement to add.</p>{/if}
		{#if form?.error}<p class="text-error-500 text-xs">{form.error}</p>{/if}

		{#if selectedEntitlement.requires_bank_id}
			<label class="label">
				<span class="label-text">Select Bank</span>
				<select class="select" name="bank_id" bind:value={selectedBankId}>
					<option value="" disabled>Select a bank</option>
					{#each allBanks as bank}
						<option value={bank.bank_id}>{bank.name} ({bank.bank_id})</option>
					{/each}
				</select>
			</label>
		{/if}
        <button class="btn preset-outlined-tertiary-500" type="submit">Add Entitlement</button>
	</form>
{:else if !canCreateEntitlements}
	<h2 class="mt-8 mb-4 text-xl font-semibold">Request Entitlement</h2>
{/if}
