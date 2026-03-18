<script lang="ts">
	let { data, form } = $props();

	$effect(() => {
		if (form?.success && form?.redirectUrl) {
			window.location.href = form.redirectUrl;
		}
	});
</script>

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Confirm VRP Consent</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				Please enter the OTP code to finalise the VRP consent.
			</p>

			{#if form?.error}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.error}</p>
				</div>
			{/if}

			{#if form?.success && !form?.redirectUrl}
				<div
					class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
				>
					<p class="font-semibold text-green-600 dark:text-green-400">{form.message}</p>
				</div>
			{:else if form?.success && form?.redirectUrl}
				<div
					class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
				>
					<p class="font-semibold text-green-600 dark:text-green-400">
						Consent confirmed. Redirecting...
					</p>
				</div>
			{:else}
				<form method="post" class="space-y-4">
					<input type="hidden" name="consentId" value={data.consentId} />

					<div>
						<label
							for="otp"
							class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							OTP Code
						</label>
						<input
							id="otp"
							name="otp"
							type="text"
							required
							class="input w-full rounded-md border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-800"
							placeholder="Enter OTP code"
						/>
					</div>

					<button type="submit" class="btn preset-filled-primary-500 w-full">Confirm</button>
				</form>
			{/if}
	</div>
