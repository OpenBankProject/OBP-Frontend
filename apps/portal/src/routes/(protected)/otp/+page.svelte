<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-lg p-8">
		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">OTP Verification</h1>

		{#if data.loadError}
			<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
				<p class="text-error-500 font-semibold">{data.loadError}</p>
			</div>
		{/if}

			<p class="mb-6 text-gray-700 dark:text-gray-300">
				{#if data.flow === 'payment'}
					Please enter the OTP to authorise this payment.
				{:else}
					Please enter the OTP to authorise this transaction request.
				{/if}
			</p>

			{#if form?.error}
				<div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-4">
					<p class="text-error-500 font-semibold">{form.error}</p>
				</div>
			{/if}

			{#if form?.success}
				<div
					class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
				>
					<p class="font-semibold text-green-600 dark:text-green-400">{form.message}</p>
				</div>
			{:else}
				<form method="post" class="space-y-4">
					<input type="hidden" name="flow" value={data.flow} />

					{#if data.flow === 'payment'}
						<input type="hidden" name="paymentService" value={data.paymentService} />
						<input type="hidden" name="paymentProduct" value={data.paymentProduct} />
						<input type="hidden" name="paymentId" value={data.paymentId} />
					{:else}
						<input type="hidden" name="id" value={data.id} />
						<input type="hidden" name="bankId" value={data.bankId} />
						<input type="hidden" name="accountId" value={data.accountId} />
						<input type="hidden" name="viewId" value={data.viewId} />
						<input
							type="hidden"
							name="transactionRequestType"
							value={data.transactionRequestType}
						/>
						<input
							type="hidden"
							name="transactionRequestId"
							value={data.transactionRequestId}
						/>
					{/if}

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

					<button type="submit" class="btn preset-filled-primary-500 w-full">Verify OTP</button>
				</form>
			{/if}
	</div>
