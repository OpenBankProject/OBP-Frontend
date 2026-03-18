<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';

	let showBubble = $state(false);
	let isClosing = $state(false);

	const COOKIE_NAME = 'obp_portal_welcomed';
	const COOKIE_EXPIRY_DAYS = 365;

	// Get welcome message from environment variable
	const welcomeMessage = env.PUBLIC_WELCOME_MESSAGE || '';

	onMount(() => {
		// Don't show bubble if welcome message is not set or empty
		if (!welcomeMessage || welcomeMessage.trim() === '') {
			return;
		}

		// Check if the user has already been welcomed
		const hasBeenWelcomed = getCookie(COOKIE_NAME);

		if (!hasBeenWelcomed) {
			// Show the bubble after a short delay for better UX
			setTimeout(() => {
				showBubble = true;
			}, 500);
		}
	});

	function getCookie(name: string): string | null {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) {
			return parts.pop()?.split(';').shift() || null;
		}
		return null;
	}

	function setCookie(name: string, value: string, days: number) {
		const date = new Date();
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
		const expires = `expires=${date.toUTCString()}`;
		document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
	}

	function handleClose() {
		isClosing = true;
		// Set cookie to remember the user has been welcomed
		setCookie(COOKIE_NAME, 'true', COOKIE_EXPIRY_DAYS);

		// Wait for animation to complete before hiding
		setTimeout(() => {
			showBubble = false;
			isClosing = false;
		}, 300);
	}
</script>

{#if showBubble}
	<div
		class="fixed top-8 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4 animate-in fade-in slide-in-from-top-4 duration-500"
		class:animate-out={isClosing}
		class:fade-out={isClosing}
		class:slide-out-to-top-4={isClosing}
	>
		<div
			class="relative rounded-lg border-2 border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100 p-6 shadow-2xl dark:border-primary-400 dark:from-primary-900 dark:to-primary-800"
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={handleClose}
				class="absolute top-3 right-3 rounded-full p-1 text-surface-600 transition-colors hover:bg-surface-200 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-700 dark:hover:text-surface-100"
				aria-label="Close welcome message"
			>
				<X class="h-5 w-5" />
			</button>

			<!-- Welcome logo -->
			<div class="mb-3">
				<img src="/obp_logo.svg" alt="Open Bank Project" class="h-12 w-auto" />
			</div>

			<!-- Welcome message -->
			<div class="pr-6 text-sm leading-relaxed text-surface-900 dark:text-surface-100">
				{welcomeMessage}
			</div>

			<!-- Decorative accent -->
			<div
				class="absolute bottom-0 right-0 h-24 w-24 rounded-tl-full bg-gradient-to-br from-primary-400/20 to-primary-600/20"
			></div>
		</div>
	</div>
{/if}

<style>
	.animate-in {
		animation-duration: 500ms;
		animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
	}

	.fade-in {
		animation-name: fadeIn;
	}

	.slide-in-from-top-4 {
		animation-name: slideInFromTop;
	}

	.animate-out {
		animation-duration: 300ms;
		animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
	}

	.fade-out {
		animation-name: fadeOut;
	}

	.slide-out-to-top-4 {
		animation-name: slideOutToTop;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideInFromTop {
		from {
			transform: translate(-50%, -1rem);
		}
		to {
			transform: translate(-50%, 0);
		}
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@keyframes slideOutToTop {
		from {
			transform: translate(-50%, 0);
		}
		to {
			transform: translate(-50%, -1rem);
		}
	}
</style>