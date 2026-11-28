<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { isSafeExternalRedirect } from '@obp/shared/utils';

	let { data } = $props();

	// This page is only shown after a successful confirmation, so the PSU goes back to TPP-Redirect-URI.
	// TPP-Nok-Redirect-URI is for a failed or refused authorisation and is never used here: a timer used
	// to send the PSU there two seconds after success, which told the TPP the consent had failed.
	function redirectToTpp() {
		if (isSafeExternalRedirect(data.tppRedirectUri)) {
			window.location.href = data.tppRedirectUri;
		}
	}
</script>

<div class="mx-auto max-w-lg p-8 text-center">
		{#if data.loadError}
			<div class="mb-4 rounded-lg border p-4 ui-tone-error">
				<p class="font-semibold ui-text-error">{data.loadError}</p>
			</div>
		{/if}

			<div
				class="mb-6 rounded-lg border p-6 ui-tone-success"
			>
				<h1 class="mb-2 text-2xl font-bold ui-text-success">
					Consent Confirmed
				</h1>
				<p class="ui-text-success">
					Your consent has been successfully confirmed. Status: <strong>{data.status}</strong>
				</p>
			</div>

			{#if data.tppRedirectUri}
				<p class="mb-4 ui-muted">
					Click the button below to return to the application.
				</p>
				<button onclick={redirectToTpp} class="btn preset-filled-primary-500"> Ok </button>
			{:else}
				<p class="ui-muted">
					You may now close this window or <a href="/" class="hover:underline ui-text-brand"
						>return to the home page</a
					>.
				</p>
			{/if}
	</div>
