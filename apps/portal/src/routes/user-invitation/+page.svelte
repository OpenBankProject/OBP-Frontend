<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { Eye, EyeOff, CheckCircle, AlertCircle, UserPlus } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isValidating = $state(false);
	let invitationValidated = $state(false);
	let invitationData = $state<any>(null);
	let validationAttempted = $state(false);
	
	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let privacyPolicy = $state(false);
	let termsConditions = $state(false);
	let personalData = $state(false);
	let marketing = $state(false);

	let passwordsMatch = $derived(password === confirmPassword && confirmPassword.length > 0);
	let passwordValid = $derived(password.length >= 8);

	let canSubmit = $derived(
		invitationValidated &&
		username.trim().length > 0 &&
		passwordValid &&
		passwordsMatch &&
		privacyPolicy &&
		termsConditions &&
		personalData
	);

	// Auto-validate invitation on page load
	$effect(() => {
		if (data.secretKey && !isValidating && !invitationValidated && !validationAttempted) {
			validateInvitation();
		}
	});

	// Update invitation data when form response comes back
	$effect(() => {
		if (form?.success && form?.invitation) {
			invitationValidated = true;
			invitationData = form.invitation;
			isValidating = false;
			
			// Generate a suggested username
			if (form.invitation.first_name && form.invitation.last_name) {
				username = `${form.invitation.first_name.toLowerCase()}.${form.invitation.last_name.toLowerCase()}`;
			}
		} else if (form?.error) {
			// Stop loading state when error is received
			isValidating = false;
		}
	});

	async function validateInvitation() {
		isValidating = true;
		validationAttempted = true;
		const formElement = document.getElementById('validate-form') as HTMLFormElement;
		if (formElement) {
			formElement.requestSubmit();
		}
		// The form submission will update the form variable via SvelteKit's form actions
		// isValidating will be set to false in the $effect when form response arrives
	}
</script>

<div
	class="card dark:bg-primary-500/50 backdrop-blur-3xl border-primary-200-800 divide-primary-200-800 mx-auto my-10 md:px-15 flex flex-col divide-y border-[1px] shadow-lg max-w-[90%] lg:max-w-3xl"
>
	<header class="py-4 px-6">
		<div class="flex items-center justify-center gap-3">
			<UserPlus class="h-8 w-8 text-primary-500" />
			<h1 class="h4 text-center">Welcome! Complete Your Account Setup</h1>
		</div>
		<p class="text-center text-sm text-gray-400 mt-2">
			You've been invited to join the platform. Please complete the information below to create
			your account.
		</p>
	</header>

	<article class="space-y-4 p-6">
		<!-- Hidden form for validation -->
		<form id="validate-form" method="POST" action="?/validate" class="hidden">
			<input type="hidden" name="secret_key" value={data.secretKey} />
		</form>

		<!-- Loading State -->
		{#if isValidating && !invitationValidated && !form?.error}
			<div class="flex flex-col items-center justify-center py-12 space-y-4">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
				<p class="text-gray-400">Validating your invitation...</p>
			</div>
		{/if}

		<!-- Error State -->
		{#if form?.error && !invitationValidated && !isValidating}
			<div class="bg-error-500/10 border-error-500 rounded-lg border p-6 space-y-4">
				<div class="flex items-start gap-3">
					<AlertCircle class="h-6 w-6 text-error-500 flex-shrink-0 mt-1" />
					<div class="flex-1">
						<h3 class="font-semibold text-error-500 text-lg mb-2">Invitation Invalid</h3>
						<p class="text-error-500">{form.error}</p>
						<p class="text-sm text-gray-400 mt-4">
							If you believe this is an error, please contact your administrator or request a new
							invitation.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Success - Show Form -->
		{#if invitationValidated && invitationData}
			<div class="space-y-6">
				<!-- Success Message -->
				<div class="bg-success-500/10 border-success-500 rounded-lg border p-4">
					<div class="flex items-start gap-3">
						<CheckCircle class="h-6 w-6 text-success-500 flex-shrink-0 mt-1" />
						<div class="flex-1">
							<h3 class="font-semibold text-success-500">Invitation Validated</h3>
							<p class="text-sm text-gray-300 mt-1">
								Your invitation has been verified. Please review the information below and complete
								your account setup.
							</p>
						</div>
					</div>
				</div>

				<!-- Invitation Details -->
				<div class="bg-surface-700 rounded-lg p-6 space-y-4">
					<h3 class="text-lg font-semibold mb-4">Your Invitation Details</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<span class="text-sm text-gray-400 block">First Name</span>
							<p class="font-medium">{invitationData.first_name}</p>
						</div>
						<div>
							<span class="text-sm text-gray-400 block">Last Name</span>
							<p class="font-medium">{invitationData.last_name}</p>
						</div>
						<div>
							<span class="text-sm text-gray-400 block">Email</span>
							<p class="font-medium">{invitationData.email}</p>
						</div>
						<div>
							<span class="text-sm text-gray-400 block">Company</span>
							<p class="font-medium">{invitationData.company}</p>
						</div>
						<div>
							<span class="text-sm text-gray-400 block">Country</span>
							<p class="font-medium">{invitationData.country}</p>
						</div>
						<div>
							<span class="text-sm text-gray-400 block">Account Type</span>
							<p class="font-medium capitalize">{invitationData.purpose?.toLowerCase() || 'N/A'}</p>
						</div>
					</div>
				</div>

				<!-- Account Setup Form -->
				<form method="POST" action="?/accept" class="space-y-6" use:enhance>
					<input type="hidden" name="secret_key" value={data.secretKey} />
					<input type="hidden" name="first_name" value={invitationData.first_name} />
					<input type="hidden" name="last_name" value={invitationData.last_name} />
					<input type="hidden" name="email" value={invitationData.email} />
					<input type="hidden" name="company" value={invitationData.company} />
					<input type="hidden" name="country" value={invitationData.country} />

					<!-- Username Field -->
					<label class="label">
						<span class="label-text text-left font-semibold">
							Choose Your Username <span class="text-error-500">*</span>
						</span>
						<input
							type="text"
							class="input"
							name="username"
							bind:value={username}
							placeholder="e.g., john.doe"
							required
						/>
						<span class="text-xs text-gray-400 mt-1">
							This will be your unique identifier for logging in
						</span>
					</label>

					<!-- Password Field -->
					<label class="label">
						<span class="label-text text-left font-semibold">
							Create Password <span class="text-error-500">*</span>
						</span>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'}
								class="input pr-10"
								name="password"
								bind:value={password}
								placeholder="Enter a secure password"
								required
								minlength="8"
							/>
							<button
								type="button"
								class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{#if showPassword}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
						<span class="text-xs text-gray-400 mt-1">
							Password must be at least 8 characters long
						</span>
						{#if password.length > 0 && !passwordValid}
							<span class="text-xs text-error-500 mt-1">
								Password is too short (minimum 8 characters)
							</span>
						{/if}
					</label>

					<!-- Confirm Password Field -->
					<label class="label">
						<span class="label-text text-left font-semibold">
							Confirm Password <span class="text-error-500">*</span>
						</span>
						<div class="relative">
							<input
								type={showConfirmPassword ? 'text' : 'password'}
								class="input pr-10"
								name="confirm_password"
								bind:value={confirmPassword}
								placeholder="Re-enter your password"
								required
								minlength="8"
							/>
							<button
								type="button"
								class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
							>
								{#if showConfirmPassword}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
						{#if confirmPassword.length > 0 && !passwordsMatch}
							<span class="text-xs text-error-500 mt-1">Passwords do not match</span>
						{:else if confirmPassword.length > 0 && passwordsMatch}
							<span class="text-xs text-success-500 mt-1">✓ Passwords match</span>
						{/if}
					</label>

					<hr class="hr" />

					<!-- Terms and Conditions -->
					<div class="space-y-4">
						<h3 class="text-lg font-semibold">Terms and Agreements</h3>
						<p class="text-sm text-gray-400">
							Please review and accept the following to create your account:
						</p>

						<!-- Privacy Policy -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox mt-1"
								name="privacy_policy"
								bind:checked={privacyPolicy}
								required
							/>
							<div class="flex-1">
								<span class="font-medium">
									Privacy Policy <span class="text-error-500">*</span>
								</span>
								<p class="text-sm text-gray-400">
									I have read and accept the
									<a href="/privacy-policy" target="_blank" class="text-primary-500 hover:underline">
										Privacy Policy
									</a>
								</p>
							</div>
						</label>

						<!-- Terms and Conditions -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox mt-1"
								name="terms_conditions"
								bind:checked={termsConditions}
								required
							/>
							<div class="flex-1">
								<span class="font-medium">
									Terms and Conditions <span class="text-error-500">*</span>
								</span>
								<p class="text-sm text-gray-400">
									I agree to the
									<a
										href="/terms-and-conditions"
										target="_blank"
										class="text-primary-500 hover:underline"
									>
										Terms and Conditions
									</a>
								</p>
							</div>
						</label>

						<!-- Personal Data Consent -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox mt-1"
								name="personal_data"
								bind:checked={personalData}
								required
							/>
							<div class="flex-1">
								<span class="font-medium">
									Personal Data Collection <span class="text-error-500">*</span>
								</span>
								<p class="text-sm text-gray-400">
									I consent to the collection and processing of my personal data as described in the
									Privacy Policy
								</p>
							</div>
						</label>

						<!-- Marketing (Optional) -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input type="checkbox" class="checkbox mt-1" name="marketing" bind:checked={marketing} />
							<div class="flex-1">
								<span class="font-medium">Marketing Communications (Optional)</span>
								<p class="text-sm text-gray-400">
									I would like to receive updates, newsletters, and promotional materials
								</p>
							</div>
						</label>
					</div>

					{#if form?.error && invitationValidated}
						<div class="bg-error-500/10 border-error-500 rounded-lg border p-4 text-center">
							<p class="text-error-500 font-semibold">{form.error}</p>
						</div>
					{/if}

					<hr class="hr" />

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={!canSubmit}
						class="btn preset-filled-primary-500 w-full disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Create Account"
					>
						{#if !username.trim()}
							Enter Username to Continue
						{:else if !passwordValid}
							Password Must Be At Least 8 Characters
						{:else if !passwordsMatch}
							Passwords Must Match
						{:else if !privacyPolicy || !termsConditions || !personalData}
							Accept Required Terms to Continue
						{:else}
							Create Account
						{/if}
					</button>

					<p class="text-xs text-center text-gray-400">
						<span class="text-error-500">*</span> Required fields
					</p>
				</form>
			</div>
		{/if}

		<!-- Help Text -->
		{#if !invitationValidated && !form?.error && !isValidating}
			<div class="text-center py-8">
				<p class="text-gray-400">
					If you're having trouble, please contact support or request a new invitation.
				</p>
			</div>
		{/if}
	</article>
</div>

<style>
	:global(body) {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
	}
</style>