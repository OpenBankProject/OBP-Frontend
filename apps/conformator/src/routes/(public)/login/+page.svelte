<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { m } from '@obp/shared/i18n';

	let { data } = $props();

	const messages: Record<string, () => string> = {
		access_denied: m.login_error_access_denied,
		login_failed: m.login_error_login_failed,
		session_expired: m.login_error_session_expired,
		invalid_state: m.login_error_invalid_state,
		provider_unavailable: m.login_error_provider_unavailable,
		user_lookup_failed: m.login_error_user_lookup_failed
	};
</script>

<h1 class="h2">{m.login_heading()}</h1>

{#if data.loginError}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert" data-testid="login-error">{messages[data.loginError]?.()}</p>
{/if}

{#if data.providers.length === 0}
	<p class="mt-4" data-testid="no-providers">{m.login_no_providers()}</p>
{:else}
	<ul class="mt-4 flex flex-col gap-2">
		{#each data.providers as provider (provider)}
			<li><a class="btn preset-filled" href="/login/{provider}" data-testid="login-provider-{provider}">{m.login_with({ provider })}</a></li>
		{/each}
	</ul>
{/if}
