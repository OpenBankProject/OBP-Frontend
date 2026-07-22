<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
		UK Open Banking — Verify
	</h1>

	{#if data.loadError}
		<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
			<p class="text-error-500 font-semibold">{data.loadError}</p>
		</div>
	{:else}
		<p class="mb-6 text-gray-700 dark:text-gray-300">
			A one-time passcode (OTP) has been sent to authorise this consent. Enter it below to complete
			Strong Customer Authentication.
		</p>

		{#if form?.message}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{form.message}</p>
			</div>
		{/if}

		<form method="post" class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
			<label for="otp" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
				One-time passcode
			</label>
			<input
				id="otp"
				name="otp"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				placeholder="Enter OTP"
				class="input mb-4 w-full rounded border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />

			<input type="hidden" name="consentId" value={data.consentId} />
			<input type="hidden" name="bankId" value={data.bankId} />
			<input type="hidden" name="challengeId" value={data.challengeId} />
			<input type="hidden" name="oidcReturnUrl" value={data.oidcReturnUrl} />
			<input type="hidden" name="accountIds" value={data.accountIds} />

			<button type="submit" class="btn preset-filled-primary-500 w-full">
				Verify &amp; Authorise
			</button>
		</form>
	{/if}
</div>
