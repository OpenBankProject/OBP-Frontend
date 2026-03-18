<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Consent Request</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				<strong>{data.consumerName}</strong> is requesting access to your account information.
			</p>

			{#if form?.error}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.error}</p>
				</div>
			{/if}

			<!-- Permissions Requested -->
			<div class="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
					Permissions Requested
				</h2>
				<div class="space-y-2">
					{#if data.hasAccountAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
							<span class="text-gray-700 dark:text-gray-300">Read account details</span>
						</div>
					{/if}
					{#if data.hasBalanceAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
							<span class="text-gray-700 dark:text-gray-300">Read balances</span>
						</div>
					{/if}
					{#if data.hasTransactionAccess}
						<div class="flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
							<span class="text-gray-700 dark:text-gray-300">Read transactions</span>
						</div>
					{/if}
				</div>

				{#if data.validUntil}
					<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
						Valid until: <strong>{data.validUntil}</strong>
					</p>
				{/if}
			</div>

			<!-- Account Selection -->
			{#if data.needsAccountSelection && data.userIbans.length > 0}
				<div class="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
						Select Accounts
					</h2>
					<p class="mb-4 text-sm text-gray-700 dark:text-gray-300">
						Please select the accounts you want to grant access to:
					</p>
					<form method="post" action="?/confirm" id="confirmForm">
						<input type="hidden" name="consentId" value={data.consentId} />
						<input type="hidden" name="hasBalanceAccess" value={String(data.hasBalanceAccess)} />
						<input
							type="hidden"
							name="hasTransactionAccess"
							value={String(data.hasTransactionAccess)}
						/>
						<div class="space-y-3">
							{#each data.userIbans as account}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
								>
									<input
										type="checkbox"
										name="selectedIbans"
										value={account.iban}
										checked={data.preSelectedIbans.includes(account.iban)}
										class="checkbox"
									/>
									<div>
										<span class="font-medium text-gray-900 dark:text-gray-100"
											>{account.label}</span
										>
										<span class="ml-2 text-sm text-gray-500 dark:text-gray-400"
											>{account.iban}</span
										>
									</div>
								</label>
							{/each}
						</div>
					</form>
				</div>
			{:else if data.allAccountsRequested}
				<div class="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
					<p class="text-sm text-blue-800 dark:text-blue-200">
						Access is requested for all your accounts.
					</p>
				</div>
			{:else if data.preSelectedIbans.length > 0}
				<div class="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Accounts</h2>
					<div class="space-y-2">
						{#each data.preSelectedIbans as iban}
							<div class="rounded-md border p-3 dark:border-gray-600">
								<span class="text-gray-900 dark:text-gray-100">{iban}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-4">
				{#if data.needsAccountSelection}
					<button type="submit" form="confirmForm" class="btn preset-filled-primary-500 flex-1">
						Confirm
					</button>
				{:else}
					<form method="post" action="?/confirm" class="flex-1">
						<input type="hidden" name="consentId" value={data.consentId} />
						<input type="hidden" name="hasBalanceAccess" value={String(data.hasBalanceAccess)} />
						<input
							type="hidden"
							name="hasTransactionAccess"
							value={String(data.hasTransactionAccess)}
						/>
						<button type="submit" class="btn preset-filled-primary-500 w-full">Confirm</button>
					</form>
				{/if}

				<form method="post" action="?/deny" class="flex-1">
					<input type="hidden" name="consentId" value={data.consentId} />
					<input type="hidden" name="tppNokRedirectUri" value={data.tppNokRedirectUri} />
					<button type="submit" class="btn preset-filled-error-500 w-full">Deny</button>
				</form>
			</div>
	</div>
