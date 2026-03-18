<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Eye, EyeOff } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let passwordVisibilityType = $derived.by(() => (showPassword ? 'text' : 'password'));

	function checkPasswordAgainstPolicy(password: string): boolean {
		if (password.length < 10 || password.length > 512) {
			return false;
		}

		// 17+ characters: length alone is sufficient
		if (password.length >= 17) {
			return true;
		}

		// 10-16 characters: require complexity
		const hasUpperCase = /[A-Z]/.test(password);
		const hasLowerCase = /[a-z]/.test(password);
		const hasNumbers = /\d/.test(password);
		const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

		return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChars;
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function checkPasswordsMatching() {
		if (newPassword !== confirmPassword) {
			return false;
		}
		return true;
	}

	let isPasswordValid = $derived(checkPasswordAgainstPolicy(newPassword));
	let arePasswordsMatching = $derived(checkPasswordsMatching());
	let needsComplexity = $derived(newPassword.length < 17);

	let canSubmit = $derived(
		isPasswordValid && arePasswordsMatching && newPassword.length > 0 && confirmPassword.length > 0
	);
</script>

<div
	class="card dark:bg-primary-500/50 backdrop-blur-3xl border-primary-200-800 divide-primary-200-800 mx-auto my-10 md:px-15 flex flex-col divide-y border-[1px] shadow-lg max-w-[90%] lg:max-w-2xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Reset Your Password</h1>
		<p class="text-center text-sm text-gray-400 mt-2">Enter your new password below</p>
	</header>
	<article class="space-y-4 p-4">
		<form class="mx-auto w-full max-w-md space-y-6" method="POST">
			{#if form?.error}
				<div class="bg-error-500/10 border-error-500 rounded-lg border p-4 text-center">
					<p class="text-error-500 font-semibold">{form.error}</p>
				</div>
			{/if}

			<label class="label">
				<span class="label-text text-left">New Password</span>
				<div class="relative">
					<input
						type={passwordVisibilityType}
						class="input pr-10"
						name="new_password"
						bind:value={newPassword}
						placeholder="Enter New Password"
						required
					/>
					<button
						type="button"
						class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-gray-700"
						onclick={togglePasswordVisibility}
					>
						{#if showPassword}
							<EyeOff class="h-5 w-5" />
						{:else}
							<Eye class="h-5 w-5" />
						{/if}
					</button>
				</div>

				{#if newPassword.length > 0 && !isPasswordValid}
					<div class="text-error-500 text-xs mt-2 space-y-1">
						<p class="font-semibold">Password must meet the following requirements:</p>
						<ul class="list-disc list-inside">
							<li class={newPassword.length >= 10 ? 'text-success-500' : ''}>
								At least 10 characters
							</li>
							{#if needsComplexity}
								<li class={/[A-Z]/.test(newPassword) ? 'text-success-500' : ''}>
									At least one uppercase letter
								</li>
								<li class={/[a-z]/.test(newPassword) ? 'text-success-500' : ''}>
									At least one lowercase letter
								</li>
								<li class={/\d/.test(newPassword) ? 'text-success-500' : ''}>
									At least one number
								</li>
								<li class={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-success-500' : ''}>
									At least one special character
								</li>
							{/if}
							<li class={newPassword.length <= 512 ? 'text-success-500' : ''}>
								At most 512 characters
							</li>
						</ul>
						{#if newPassword.length >= 10 && needsComplexity}
							<p class="text-xs opacity-75 mt-1">
								Tip: Passwords of 17 or more characters only need to meet the length requirement.
							</p>
						{/if}
					</div>
				{/if}
			</label>

			<label class="label">
				<span class="label-text text-left">Confirm New Password</span>
				<div class="relative">
					<input
						type={passwordVisibilityType}
						class="input pr-10"
						name="confirm_password"
						bind:value={confirmPassword}
						placeholder="Confirm New Password"
						required
					/>
					<button
						type="button"
						class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-gray-700"
						onclick={togglePasswordVisibility}
					>
						{#if showPassword}
							<EyeOff class="h-5 w-5" />
						{:else}
							<Eye class="h-5 w-5" />
						{/if}
					</button>
				</div>

				{#if newPassword.length > 0 && confirmPassword.length > 0 && !arePasswordsMatching}
					<p class="text-error-500 text-xs mt-2">Passwords do not match!</p>
				{/if}

				{#if arePasswordsMatching && confirmPassword.length > 0 && isPasswordValid}
					<p class="text-success-500 text-xs mt-2">Passwords match</p>
				{/if}
			</label>

			<hr class="hr" />

			<button
				type="submit"
				disabled={!canSubmit}
				class="btn preset-filled-primary-500 mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Reset Password"
			>
				{#if !isPasswordValid}
					Password Must Meet Requirements
				{:else if !arePasswordsMatching}
					Passwords Must Match
				{:else}
					Reset Password
				{/if}
			</button>

			<div class="text-center mt-4">
				<a href="/login" class="text-sm text-primary-500 hover:text-primary-400">
					Back to Login
				</a>
			</div>
		</form>
	</article>
</div>
