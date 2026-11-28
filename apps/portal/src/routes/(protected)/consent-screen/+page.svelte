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
	let { data, form } = $props();
	let rememberConsent = $state(false);
</script>

<div class="mx-auto max-w-lg p-8">
		<div class="rounded-lg p-8 shadow-md ui-card">
			<h1 class="mb-2 text-2xl font-bold ui-text">
				Authorisation Request
			</h1>

			{#if data.loadError}
				<div class="mt-4 mb-4 rounded-lg border p-4 ui-tone-error">
					<p class="font-semibold ui-text-error">{data.loadError}</p>
				</div>
			{/if}

				<!-- TODO: applicationName and requestedScopes are placeholder values.
					 Replace with actual data from the OIDC provider's consent introspection API.
					 See +page.server.ts for details on provider-specific integration. -->
				<p class="mb-6 ui-muted">
					Hi <strong>{data.username}</strong>, <strong>{data.applicationName}</strong> wants to act
					on your behalf.
				</p>

				{#if form?.message}
					<div class="mb-4 rounded-lg border p-4 ui-tone-error">
						<p class="font-semibold ui-text-error">{form.message}</p>
					</div>
				{/if}

				{#if form?.success}
					<div
						class="mb-4 rounded-lg border p-4 ui-tone-success"
					>
						<p class="font-semibold ui-text-success">{form.message}</p>
					</div>
				{:else}
					<!-- Requested Scopes -->
					{#if data.requestedScopes && data.requestedScopes.length > 0}
						<div class="mb-6">
							<h2 class="mb-2 text-sm font-semibold ui-muted">
								This application is requesting the following permissions:
							</h2>
							<ul class="list-disc pl-5 text-sm ui-muted">
								{#each data.requestedScopes as scope}
									<li>{scope}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Remember Consent -->
					<label class="mb-6 flex cursor-pointer items-center gap-3">
						<input type="checkbox" class="checkbox" bind:checked={rememberConsent} />
						<span class="text-sm ui-muted"
							>Don't ask me again for this application</span
						>
					</label>

					<!-- Actions -->
					<div class="flex gap-4">
						<form method="post" action="?/allow" class="flex-1">
							<input type="hidden" name="consentChallenge" value={data.consentChallenge} />
							{#if rememberConsent}
								<input type="hidden" name="rememberConsent" value="on" />
							{/if}
							<button type="submit" class="btn preset-filled-primary-500 w-full">Allow</button>
						</form>

						<form method="post" action="?/deny" class="flex-1">
							<input type="hidden" name="consentChallenge" value={data.consentChallenge} />
							<button type="submit" class="btn preset-outlined-surface-500 w-full">Deny</button>
						</form>
					</div>
				{/if}
		</div>
	</div>
