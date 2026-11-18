<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { page } from '$app/state';

	let { data, form } = $props();
</script>

<h1 class="h2">Your Roles</h1>
<p class="mt-2">The Roles the staff pages use. Most are at the central space, <code>{data.space}</code>.</p>

{#if page.url.searchParams.has('no_role')}<p class="mt-4 preset-tonal-warning rounded p-3" role="status" data-testid="access-no-role">The staff pages need at least one of these Roles. Ask for the ones your work needs.</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{form.error}</p>{/if}
{#if form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">Your request for {form.requested} is waiting for an administrator.</p>{/if}

<table class="table mt-4" data-testid="access-roles">
	<thead>
		<tr><th>Role</th><th>Where</th><th>Needed for</th><th>Held</th></tr>
	</thead>
	<tbody>
		{#each data.roles as role (role.role_name)}
			<tr data-testid="access-role-{role.role_name}">
				<td><code>{role.role_name}</code></td>
				<td>{#if role.bank_id}<code>{role.bank_id}</code>{:else}system level{/if}</td>
				<td>{role.purpose}</td>
				<td>
					{#if role.held}
						Yes
					{:else if role.requested}
						Requested
					{:else}
						<form method="POST" action="?/request">
							<input type="hidden" name="role_name" value={role.role_name} />
							<button class="btn btn-sm preset-tonal" data-testid="access-request-{role.role_name}">Ask for it</button>
						</form>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<p class="mt-4 text-sm">
	An administrator accepts requests in the API Manager.
	{#if data.entitlementRequestsUrl}<a class="anchor" href={data.entitlementRequestsUrl}>Open the requests waiting there</a>{/if}
</p>
