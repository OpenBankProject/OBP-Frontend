<script lang="ts">
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

	let username = $state('');
	let email = $state('');

	let canSubmit = $derived(username.trim().length > 0 && email.length > 0 && email.includes('@'));
</script>

<div
	class="card dark:bg-primary-500/50 backdrop-blur-3xl border-primary-200-800 divide-primary-200-800 mx-auto my-10 md:px-15 flex flex-col divide-y border-[1px] shadow-lg max-w-[90%] lg:max-w-2xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Forgot Your Password?</h1>
		<p class="text-center text-sm mt-2 opacity-75">
			Enter your username and email address and we'll send you a link to reset your password
		</p>
	</header>
	<article class="space-y-4 p-4">
		{#if form?.success}
			<!-- Success Message -->
			<div class="mx-auto w-full max-w-md space-y-4">
				<div class="rounded-lg border border-success-500 bg-success-500/10 p-6 text-center">
					<div class="flex justify-center mb-4">
						<svg class="h-16 w-16 text-success-500" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							></path>
						</svg>
					</div>
					<p class="text-success-500 font-semibold text-lg mb-2">Check Your Email</p>
					<p class="text-sm opacity-90">
						If an account exists with <strong>{form?.email}</strong>, you will receive a password
						reset link shortly.
					</p>
					<p class="text-xs mt-4 opacity-75">
						Please check your spam folder if you don't see the email within a few minutes.
					</p>
				</div>
				{#if form?.apiStatus === 'ok'}
					<div class="rounded-lg border border-success-500 bg-success-500/10 p-3 text-center">
						<p class="text-success-500 text-sm">{form.apiMessage}</p>
					</div>
				{:else if form?.apiStatus === 'error'}
					<div class="rounded-lg border border-error-500 bg-error-500/10 p-3 text-center">
						<p class="text-error-500 text-sm">{form.apiMessage}</p>
					</div>
				{/if}
				<div class="text-center">
					<a href="/login" class="btn preset-filled-primary-500">
						Back to Login
					</a>
				</div>
			</div>
		{:else}
			<!-- Request Form -->
			<form class="mx-auto w-full max-w-md space-y-6" method="POST">
				{#if form?.error}
					<div class="bg-error-500/10 border-error-500 rounded-lg border p-4 text-center">
						<p class="text-error-500 font-semibold">{form.error}</p>
					</div>
				{/if}

				<label class="label">
					<span class="label-text">Username</span>
					<input
						type="text"
						class="input"
						name="username"
						placeholder="your_username"
						bind:value={username}
						required
						autocomplete="username"
					/>
				</label>

				<label class="label">
					<span class="label-text">Email Address</span>
					<input
						type="email"
						class="input"
						name="email"
						placeholder="your.email@example.com"
						bind:value={email}
						required
						autocomplete="email"
					/>
				</label>

				<button
					type="submit"
					disabled={!canSubmit}
					class="btn preset-filled-primary-500 w-full disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Send Reset Link"
				>
					{#if !canSubmit}
						Enter Username and Email
					{:else}
						Send Reset Link
					{/if}
				</button>

				<hr class="hr" />

				<div class="text-center space-y-2">
					<a href="/login" class="block text-sm text-primary-500 hover:text-primary-400">
						Back to Login
					</a>
					<p class="text-xs opacity-75">
						Don't have an account?
						<a href="/register" class="text-primary-500 hover:text-primary-400">Register here</a>
					</p>
				</div>
			</form>
		{/if}
	</article>
</div>
