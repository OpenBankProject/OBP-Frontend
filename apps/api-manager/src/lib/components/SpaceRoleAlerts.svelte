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
<!--
  This component shows which of a page's Roles the user is missing at the space the page works on, and lets
  them request each one there.

  The central page check (SITE_MAP in roleChecker) tests a bank-level Role against the bank chosen in the
  header. Pages that pick their own space with ?bank_id=, which may be SYS for the system space, need the Role
  at that space instead, so they use this component. Each Role is checked on its own and named with what it is
  needed for, because the page still works for the actions whose Roles the user does hold.
-->
<script lang="ts">
  import { page } from "$app/state";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { checkRoles } from "$lib/utils/roleChecker";

  interface Props {
    /** The space the Roles are needed at: a bank id, or SYS. */
    bankId: string;
    /** The Roles the page uses, each with what it is needed for, e.g. "to create a webhook". */
    roles: { role: string; purpose: string }[];
  }
  let { bankId, roles }: Props = $props();

  const missing = $derived(
    roles
      .map(({ role, purpose }) => {
        const result = checkRoles(page.data.userEntitlements ?? [], [{ role, bankScoped: true }], bankId, "OR", page.data.jitEnabled ?? false);
        return { role, purpose, held: result.hasAllRoles, jitCovered: result.jitRoles.length > 0 };
      })
      .filter((r) => !r.held || r.jitCovered),
  );
</script>

{#if missing.length > 0}
  <div class="mb-4 space-y-2" data-testid="space-role-alerts">
    {#each missing as r (r.role)}
      <MissingRoleAlert roles={[r.role]} {bankId} jitCovered={r.jitCovered} message="You need this Role at {bankId} {r.purpose}." />
    {/each}
  </div>
{/if}
