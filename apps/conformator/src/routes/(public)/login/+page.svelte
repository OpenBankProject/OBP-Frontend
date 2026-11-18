<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	let { data } = $props();

	const messages: Record<string, string> = {
		access_denied: 'You chose not to log in.',
		login_failed: 'Logging in failed. Please try again.',
		session_expired: 'Logging in took too long. Please try again.',
		invalid_state: 'Logging in could not be completed. Please try again.',
		provider_unavailable: 'That way of logging in is not available at the moment.',
		user_lookup_failed: 'You logged in, but OBP-API could not tell us who you are. Please try again.'
	};
</script>

<h1 class="h2">Log in</h1>

{#if data.loginError}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert" data-testid="login-error">{messages[data.loginError]}</p>
{/if}

{#if data.providers.length === 0}
	<p class="mt-4" data-testid="no-providers">No way of logging in is set up. An administrator needs to set the OAuth client in the app's settings.</p>
{:else}
	<ul class="mt-4 flex flex-col gap-2">
		{#each data.providers as provider (provider)}
			<li><a class="btn preset-filled" href="/login/{provider}" data-testid="login-provider-{provider}">Log in with {provider}</a></li>
		{/each}
	</ul>
{/if}
