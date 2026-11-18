<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	/** The fields of a system, for adding one and for editing it. */
	let { values = {}, systemRoles, roleFixed = false }: { values?: Record<string, any>; systemRoles: readonly string[]; roleFixed?: boolean } = $props();
</script>

<div class="grid gap-3 md:grid-cols-2">
	<label class="label"><span>Name</span><input class="input" name="name" required maxlength="255" value={values.name ?? ''} /></label>
	<label class="label"><span>What it is</span>
		{#if roleFixed}
			<input type="hidden" name="system_role" value={values.system_role} />
			<span class="block py-2">{String(values.system_role).replaceAll('_', ' ')}</span>
		{:else}
			<select class="select" name="system_role">
				{#each systemRoles as role (role)}<option value={role} selected={values.system_role === role}>{role.replaceAll('_', ' ')}</option>{/each}
			</select>
		{/if}
	</label>
</div>
<label class="label"><span>Base URL of its APIs</span><input class="input" name="base_url" required maxlength="500" placeholder="https://sandbox.bank.example/open-banking/v1" value={values.base_url ?? ''} /></label>
<label class="label"><span>OpenID discovery URL, if it has one</span><input class="input" name="discovery_url" maxlength="500" placeholder="https://auth.bank.example/.well-known/openid-configuration" value={values.discovery_url ?? ''} /></label>
<div class="grid gap-3 md:grid-cols-3">
	<label class="label"><span>API profile</span><input class="input" name="api_profile" maxlength="64" value={values.api_profile ?? ''} /></label>
	<label class="label"><span>API version</span><input class="input" name="api_version" maxlength="32" value={values.api_version ?? ''} /></label>
	<label class="label"><span>Client id you issued to the runner</span><input class="input" name="runner_client_id" maxlength="255" value={values.runner_client_id ?? ''} /></label>
</div>
