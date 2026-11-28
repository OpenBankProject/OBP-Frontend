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
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import RetentionHeader from "$lib/components/retention/RetentionHeader.svelte";
  import RetentionPolicyForm from "$lib/components/retention/RetentionPolicyForm.svelte";
  import { describePolicy, RETENTION_ROLES } from "$lib/services/retention";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Data Retention - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader
    title="Data Retention"
    intro="How long each kind of resource is kept in this space, and what then happens to it: archived (kept read-only for a further period, then deleted), deleted, or for customers anonymised. Nothing comes back from the archive. Runs can be previewed, may need a second person's approval, skip resources under a legal hold, and are recorded in a disposal register. Archiving and deleting each stay off until switched on in OBP-API's props."
    bankId={data.bankId}
    bankIds={data.bankIds}
  />

  <SpaceRoleAlerts bankId={data.bankId} roles={[
    { role: RETENTION_ROLES.getPolicies, purpose: "to see its retention policies" },
    { role: RETENTION_ROLES.manage, purpose: "to create and change retention policies" },
  ]} />

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}

  <div class="mb-8 overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
    {#if data.policies.length === 0}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">No retention policies in {data.bankId}: everything is kept.</div>
    {:else}
      <table class="w-full text-sm" data-testid="policies-table">
        <thead class="ui-card">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Policy</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">What it does</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Approval</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Scheduler</th>
          </tr>
        </thead>
        <tbody class="divide-y ui-border">
          {#each data.policies as p (p.retention_policy_id)}
            <tr data-testid="row-{p.retention_policy_id}">
              <td class="px-4 py-3"><a class="underline ui-link" href="/retention/{encodeURIComponent(data.bankId)}/{encodeURIComponent(p.retention_policy_id)}">{p.name || p.entity_name || p.resource_type}</a></td>
              <td class="px-4 py-3 ui-muted">{describePolicy(p)}</td>
              <td class="px-4 py-3 ui-muted">{p.requires_approval ? "Needed" : "No"}</td>
              <td class="px-4 py-3 ui-muted">{p.enabled ? "On" : "Off"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <section class="rounded-lg border p-6 shadow-sm ui-card ui-border" data-testid="create-policy">
    <h2 class="mb-4 text-xl font-semibold ui-text">New policy in {data.bankId}</h2>
    {#if form?.error}
      <div class="mb-4 rounded-lg border p-3 text-sm ui-tone-error" data-testid="form-error">{form.error}</div>
    {/if}
    <form method="POST" action="?/create&bank_id={encodeURIComponent(data.bankId)}">
      <RetentionPolicyForm entityNames={data.entityNames} submitLabel="Create policy" />
    </form>
  </section>
</div>
