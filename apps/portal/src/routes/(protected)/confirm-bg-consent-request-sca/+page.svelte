<script lang="ts">
	let { data, form } = $props();

	// SvelteKit's "?/name" shorthand REPLACES the page's query string rather than appending to it,
	// and load() here needs CONSENT_ID from that query string. A bare "?/confirm" strips it, so a
	// wrong OTP -- which does not redirect -- re-runs load() against a URL with no CONSENT_ID and
	// the page answers "Missing required parameter" instead of showing why the code was rejected.
	// Preserve it using SvelteKit's documented form: existing params first, then "&/name".
	let actionQuery = $derived(new URLSearchParams({ CONSENT_ID: data.consentId }).toString());
</script>

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
			Strong Customer Authentication
		</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				Please enter the OTP code to confirm the consent.
			</p>

			{#if form?.message}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.message}</p>
				</div>
			{/if}

			<form method="post" action="?{actionQuery}&/confirm" class="space-y-4">
				<input type="hidden" name="consentId" value={data.consentId} />
				<input type="hidden" name="authorisationId" value={data.authorisationId} />

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

				<button type="submit" class="btn preset-filled-primary-500 w-full">Verify</button>
			</form>

			<!--
				A wrong code no longer replaces the challenge behind the PSU's back, so a code that
				expired or never arrived needs an explicit way out. This is the only path that
				invalidates the previous one.
			-->
			<form method="post" action="?{actionQuery}&/resend" class="mt-3">
				<input type="hidden" name="consentId" value={data.consentId} />
				<button type="submit" class="btn preset-tonal w-full text-sm">
					Didn't get a code? Send a new one
				</button>
			</form>
	</div>
