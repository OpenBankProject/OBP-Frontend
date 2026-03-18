<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Onboarding</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				Please enter your {data.key.replace(/_/g, ' ').toLowerCase()} to begin the verification
				process.
			</p>

			{#if form?.error}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.error}</p>
				</div>
			{/if}

			<form method="post" class="space-y-4">
				<input type="hidden" name="bankId" value={data.bankId} />
				<input type="hidden" name="scaMethod" value={data.scaMethod} />
				<input type="hidden" name="key" value={data.key} />

				<div>
					<label
						for="value"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						{data.key.replace(/_/g, ' ')}
					</label>
					<input
						id="value"
						name="value"
						type="text"
						required
						class="input w-full rounded-md border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-800"
						placeholder="Enter your {data.key.replace(/_/g, ' ').toLowerCase()}"
					/>
				</div>

				<p class="text-sm text-gray-500 dark:text-gray-400">
					Bank: <strong>{data.bankId}</strong> | SCA Method: <strong>{data.scaMethod}</strong>
				</p>

				<button type="submit" class="btn preset-filled-primary-500 w-full">Submit</button>
			</form>
	</div>
