<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
			Consent Request
		</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				{#if data.consumerName}
					<strong>{data.consumerName}</strong> is requesting access to your account.
				{:else}
					An application is requesting access to your account.
				{/if}
				Please review the details below and confirm if you agree.
			</p>

			{#if form?.message}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.message}</p>
				</div>
			{/if}

			<!-- Consent Details -->
			<div class="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
					Consent Details
				</h2>

				<div class="grid gap-3 text-sm">
					{#if data.payload.everything !== undefined}
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-700 dark:text-gray-300">Access Level:</span>
							<span class="text-gray-900 dark:text-gray-100">
								{data.payload.everything ? 'Full access to all your accounts' : 'Limited access'}
							</span>
						</div>
					{/if}

					{#if data.payload.time_to_live}
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-700 dark:text-gray-300">Valid For:</span>
							<span class="text-gray-900 dark:text-gray-100">
								{data.payload.time_to_live} seconds
							</span>
						</div>
					{/if}

					{#if data.payload.valid_from}
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-700 dark:text-gray-300">Valid From:</span>
							<span class="text-gray-900 dark:text-gray-100">{data.payload.valid_from}</span>
						</div>
					{/if}

					{#if data.bankId}
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-700 dark:text-gray-300">Bank:</span>
							<span class="text-gray-900 dark:text-gray-100">{data.bankId}</span>
						</div>
					{/if}
				</div>

				{#if !data.payload.everything && data.payload.account_access?.length}
					<div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-600">
						<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Accounts requested ({data.payload.account_access.length})
						</h3>
						<ul class="space-y-2">
							{#each data.payload.account_access as access}
								<li class="rounded bg-gray-50 p-3 text-sm dark:bg-gray-700">
									<div class="flex items-center justify-between">
										<span class="font-medium text-gray-700 dark:text-gray-300">Account:</span>
										<span class="text-gray-900 dark:text-gray-100"
											>{access.account_routing?.address}
											({access.account_routing?.scheme})</span
										>
									</div>
									<div class="flex items-center justify-between">
										<span class="font-medium text-gray-700 dark:text-gray-300">Permission:</span>
										<span class="text-gray-900 dark:text-gray-100">{access.view_id}</span>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if data.payload.entitlements?.length}
					<div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-600">
						<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Roles requested ({data.payload.entitlements.length})
						</h3>
						<ul class="space-y-1 text-sm">
							{#each data.payload.entitlements as entitlement}
								<li class="text-gray-900 dark:text-gray-100">
									{entitlement.role_name} <span class="text-gray-500">({entitlement.bank_id})</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-4">
				<form method="post" action="?/confirm" class="flex-1">
					<input type="hidden" name="consentRequestId" value={data.consentRequestId} />
					<input type="hidden" name="bankId" value={data.bankId} />
					<button type="submit" class="btn preset-filled-primary-500 w-full">
						Confirm Consent
					</button>
				</form>
				<form method="post" action="?/deny" class="flex-1">
					<button type="submit" class="btn preset-filled-error-500 w-full">
						Deny
					</button>
				</form>
			</div>
	</div>
