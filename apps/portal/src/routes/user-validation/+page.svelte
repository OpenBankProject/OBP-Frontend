<script lang="ts">
	import { CheckCircle, XCircle, Loader2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formEl: HTMLFormElement;
	let submitted = $state(false);

	// Auto-submit on real client-side mount only — a link scanner or
	// data-sveltekit-preload-data prefetch never runs this script, so the
	// single-use token is only consumed by an actual browser visit.
	$effect(() => {
		if (data.token && !submitted) {
			submitted = true;
			formEl?.requestSubmit();
		}
	});
</script>

<div
	class="card preset-filled-primary-100-900 border-primary-200-800 divide-primary-200-800 mx-auto my-10 flex max-w-md flex-col divide-y border-[1px] shadow-lg sm:max-w-2xl lg:max-w-3xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Email Validation</h1>
	</header>
	<article class="space-y-4 p-4">
		<form
			method="POST"
			action="?/validate"
			bind:this={formEl}
			use:enhance
			class="hidden"
		>
			<input type="hidden" name="token" value={data.token ?? ''} />
		</form>

		{#if !data.token}
			<div class="preset-filled-error-50-950 shadow-md rounded-lg p-6 m-1.5 text-center" data-testid="validation-error">
				<div class="flex justify-center mb-4">
					<XCircle class="h-16 w-16 text-error-500" />
				</div>
				<h2 class="h5 mb-2">Validation Failed</h2>
				<p class="text-lg mb-4">No validation token provided. Please check your email for the validation link.</p>
			</div>
		{:else if !form}
			<div class="flex flex-col items-center gap-3 p-6" data-testid="validation-pending">
				<Loader2 class="h-10 w-10 animate-spin text-primary-500" />
				<p class="text-sm text-gray-600 dark:text-gray-400">Validating your email...</p>
			</div>
		{:else if form.success}
			<div class="preset-filled-success-50-950 shadow-md rounded-lg p-6 m-1.5 text-center" data-testid="validation-success">
				<div class="flex justify-center mb-4">
					<CheckCircle class="h-16 w-16 text-success-500" />
				</div>
				<h2 class="h5 mb-2">Success!</h2>
				<p class="text-lg mb-4">{form.message}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Your email has been successfully validated. You can now log in to your account.
				</p>
				<div class="mt-6">
					<a
						href="/login"
						class="btn preset-filled-primary-500 hover:preset-filled-primary-600"
						data-testid="go-to-login"
					>
						Go to Login
					</a>
				</div>
			</div>
		{:else}
			<div class="preset-filled-error-50-950 shadow-md rounded-lg p-6 m-1.5 text-center" data-testid="validation-error">
				<div class="flex justify-center mb-4">
					<XCircle class="h-16 w-16 text-error-500" />
				</div>
				<h2 class="h5 mb-2">Validation Failed</h2>
				<p class="text-lg mb-4">{form.message}</p>
				{#if form.errorCode}
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
						Error Code: {form.errorCode}
					</p>
				{/if}
				<div class="space-y-3 mt-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Please try the following:
					</p>
					<ul class="text-sm text-left list-disc list-inside space-y-1">
						<li>Check if the validation link has expired</li>
						<li>Make sure you copied the complete link from your email</li>
						<li>Contact support if the problem persists</li>
					</ul>
					<div class="flex gap-2 justify-center mt-6">
						<a
							href="/register"
							class="btn preset-filled-secondary-500 hover:preset-filled-secondary-600"
						>
							Register Again
						</a>
						<a
							href="/login"
							class="btn preset-filled-primary-500 hover:preset-filled-primary-600"
						>
							Try Login
						</a>
					</div>
				</div>
			</div>
		{/if}

		{#if form?.data}
			<details class="preset-filled-primary-50-950 shadow-md rounded-lg p-4 m-1.5">
				<summary class="cursor-pointer font-semibold text-tertiary-400 hover:text-tertiary-500">
					View Details
				</summary>
				<div class="mt-4">
					<ul class="list-inside space-y-2 text-sm">
						{#each Object.entries(form.data) as [key, value]}
							<li>
								<strong class="text-tertiary-400">{key}:</strong>
								{#if typeof value === 'object' && value !== null}
									{JSON.stringify(value)}
								{:else}
									{value}
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</details>
		{/if}
	</article>
</div>
