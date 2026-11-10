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
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let missing = $derived(data.scopes.filter((s) => !s.held));
  const yesNo = (v: boolean) => (v ? "Yes" : "No");
</script>

<svelte:head>
  <title>Setup - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl p-6" data-testid="setup-page">
  <h1 class="h2">Setup</h1>
  <p class="mt-2 max-w-3xl">
    What the API Manager needs from OBP-API: its Consumer marked as a Platform App, and the Scopes below. Both are
    done on the Platform Apps page. App Studio, the Portal FAQ, Reports and Opey conversation recording store their
    data in dynamic entities the API Manager creates when it starts, so restart it after granting the Scopes.
  </p>

  <section class="mt-6" data-testid="setup-platform-app">
    <h2 class="h4">Platform App</h2>
    <dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      <dt>consumer_id</dt>
      <dd data-testid="setup-consumer-id"><code>{data.consumerId ?? "unknown"}</code></dd>
      <dt>Declaration</dt>
      <dd data-testid="setup-declaration">{data.declaration}</dd>
      <dt>Checked at</dt>
      <dd>{data.checkedAt ?? "not checked yet"}</dd>
    </dl>
    {#if data.problem}
      <p class="mt-2 preset-tonal-warning rounded p-3" role="alert" data-testid="setup-problem">{data.problem}</p>
    {/if}
    <a class="btn preset-filled mt-4" href="/consumers/platform-apps" data-testid="setup-platform-apps-link">Open Platform Apps</a>
  </section>

  <section class="mt-6" data-testid="setup-scopes">
    <h2 class="h4">Scopes</h2>
    {#if data.state === "ok"}
      <p class="mt-2">The Consumer holds every Scope it needs.</p>
    {:else if missing.length > 0}
      <p class="mt-2">Grant the missing Scopes on the Platform Apps page, then restart the API Manager.</p>
    {/if}
    <table class="table mt-2">
      <thead>
        <tr>
          <th>Role</th>
          <th>bank_id</th>
          <th>Needed for</th>
          <th>Held</th>
        </tr>
      </thead>
      <tbody>
        {#each data.scopes as scope (scope.role_name + scope.bank_id)}
          <tr data-testid="setup-scope-{scope.role_name}">
            <td><code>{scope.role_name}</code></td>
            <td><code>{scope.bank_id || "(system)"}</code></td>
            <td>{scope.needed_for}{scope.optional ? " (optional)" : ""}</td>
            <td>
              {yesNo(scope.held)}
              {#if !scope.held}
                <a class="anchor ms-2 text-sm" href="/consumers/platform-apps" data-testid="setup-grant-{scope.role_name}">Grant</a>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>
