<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
		UK Open Banking Consent
	</h1>

	{#if data.loadError}
		<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
			<p class="text-error-500 font-semibold">{data.loadError}</p>
		</div>
	{:else}
		<p class="mb-6 text-gray-700 dark:text-gray-300">
			An application is requesting access to your account information via UK Open Banking.
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
				<div class="flex items-center justify-between">
					<span class="font-medium text-gray-700 dark:text-gray-300">Standard:</span>
					<span class="text-gray-900 dark:text-gray-100">UK Open Banking</span>
				</div>
				{#if data.bankId}
					<div class="flex items-center justify-between">
						<span class="font-medium text-gray-700 dark:text-gray-300">Bank:</span>
						<span class="text-gray-900 dark:text-gray-100">{data.bankId}</span>
					</div>
				{/if}
				<div class="flex items-center justify-between">
					<span class="font-medium text-gray-700 dark:text-gray-300">Consent ID:</span>
					<span class="font-mono text-xs text-gray-900 dark:text-gray-100">{data.consentId}</span>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex gap-4">
			<form method="post" action="?/confirm" class="flex-1">
				<input type="hidden" name="consentId" value={data.consentId} />
				<input type="hidden" name="bankId" value={data.bankId} />
				<input type="hidden" name="oidcReturnUrl" value={data.oidcReturnUrl} />
				<button type="submit" class="btn preset-filled-primary-500 w-full">
					Confirm Consent
				</button>
			</form>
			<form method="post" action="?/deny" class="flex-1">
				<input type="hidden" name="oidcReturnUrl" value={data.oidcReturnUrl} />
				<button type="submit" class="btn preset-filled-error-500 w-full">
					Deny
				</button>
			</form>
		</div>
	{/if}
</div>
