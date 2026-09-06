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
  import { page } from "$app/state";
  import PageRoleCheck from "$lib/components/PageRoleCheck.svelte";
  import { SITE_MAP } from "$lib/utils/roleChecker";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  let { data, children } = $props();

  let routeKey = $derived(page.route.id?.replace("/(protected)", "") || "");
  let pageRoles = $derived(SITE_MAP[routeKey]);
</script>

{#if pageRoles}
  <PageRoleCheck
    userEntitlements={data.userEntitlements}
    required={pageRoles.required}
    optional={pageRoles.optional}
    requirementType={pageRoles.requirementType}
    currentBankId={currentBank.bankId}
    jitEnabled={data.jitEnabled}
  >
    {@render children()}
  </PageRoleCheck>
{:else}
  {@render children()}
{/if}
