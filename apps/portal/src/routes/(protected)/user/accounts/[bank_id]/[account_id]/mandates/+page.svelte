<script lang="ts">
	let { data } = $props();

	function fmtDate(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString();
	}

	function panelsHref(mandate_id: string): string {
		return `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels`;
	}

	const accountHref = `/user/accounts/${encodeURIComponent(data.bank_id)}/${encodeURIComponent(data.account_id)}`;
</script>

<div class="mb-4">
	<a
		class="text-sm text-primary-500 hover:underline dark:text-primary-200"
		href={accountHref}
		data-testid="back-to-account"
	>← Account</a>
</div>

<h2 class="mb-2 text-2xl font-semibold">Mandates</h2>
<p class="mb-4 text-surface-700-300">
	Mandates governing payment authority on this account. Each mandate has signatory panels (groups of authorised signers) and provisions (the signing rules).
</p>

{#if data.fetchError}
	<div class="alert variant-filled-error mb-4" data-testid="mandates-fetch-error">
		<p>Failed to load mandates: {data.fetchError}</p>
	</div>
{/if}

{#if data.mandates.length === 0 && !data.fetchError}
	<p class="text-surface-600-400" data-testid="mandates-empty">No mandates on this account.</p>
{:else if data.mandates.length > 0}
	<div class="table-container" data-testid="mandates-table">
		<table class="table-hover table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Reference</th>
					<th>Status</th>
					<th>Valid from</th>
					<th>Valid to</th>
					<th>Signatory panels</th>
				</tr>
			</thead>
			<tbody>
				{#each data.mandates as m (m.mandate_id)}
					<tr data-testid="mandate-row" data-mandate-id={m.mandate_id}>
						<td>{m.mandate_name}</td>
						<td><code class="text-xs">{m.mandate_reference}</code></td>
						<td data-testid="mandate-status">{m.status}</td>
						<td>{fmtDate(m.valid_from)}</td>
						<td>{fmtDate(m.valid_to)}</td>
						<td>
							<a
								class="text-primary-500 hover:underline dark:text-primary-200"
								href={panelsHref(m.mandate_id)}
								data-testid="mandate-panels-link"
							>Manage panels →</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
