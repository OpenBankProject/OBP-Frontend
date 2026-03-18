<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';

	interface PageHeaderProps {
		isAuthenticated?: boolean;
		username?: string;
		profileUrl?: string;
		loginUrl?: string;
		logoutUrl?: string;
		registerUrl?: string;
	}

	let {
		isAuthenticated = false,
		username = '',
		profileUrl = '/user',
		loginUrl = '/login',
		logoutUrl = '/logout',
		registerUrl = '/register'
	}: PageHeaderProps = $props();

	let userMenuOpen = $state(false);
</script>

<div
	class="bg-opacity-0 flex items-center justify-end px-4 py-2 shadow-md z-10"
	style="height: 48px; flex-shrink: 0;"
>
	{#if isAuthenticated}
		<div class="relative mx-4">
			<button
				type="button"
				class="flex items-center gap-1 hover:text-tertiary-400"
				onclick={() => (userMenuOpen = !userMenuOpen)}
				onblur={() => setTimeout(() => (userMenuOpen = false), 150)}
			>
				{username}
				<ChevronDown class="size-4" />
			</button>
			{#if userMenuOpen}
				<div class="absolute right-0 z-50 mt-2 min-w-[140px] rounded-md border border-surface-300-700 bg-surface-100-900 py-1 shadow-lg">
					<a
						href={profileUrl}
						class="block px-4 py-2 text-sm hover:preset-tonal"
					>
						My Account
					</a>
					<a
						href={logoutUrl}
						class="block px-4 py-2 text-sm hover:preset-tonal"
					>
						Logout
					</a>
				</div>
			{/if}
		</div>
	{:else}
		<span class="mx-4 hover:text-tertiary-400"><a href={registerUrl}>Register</a> </span>
		<button type="button" class="btn preset-filled-surface-950-50"
			><a href={loginUrl}>Login</a></button
		>
	{/if}
</div>
