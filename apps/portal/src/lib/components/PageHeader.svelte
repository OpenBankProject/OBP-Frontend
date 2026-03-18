<script lang="ts">
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
</script>

<div
	class="bg-opacity-0 flex items-center justify-end p-4"
	style="height: 80px; flex-shrink: 0;"
>
	{#if isAuthenticated}
		<span class="mx-4 hover:text-tertiary-400"><a href={profileUrl}>{username}</a></span>
		<button type="button" class="btn preset-outlined-primary-500"
			><a href={logoutUrl}>Logout</a></button
		>
	{:else}
		<span class="mx-4 hover:text-tertiary-400"><a href={registerUrl}>Register</a> </span>
		<button type="button" class="btn preset-filled-surface-950-50"
			><a href={loginUrl}>Login</a></button
		>
	{/if}
</div>
