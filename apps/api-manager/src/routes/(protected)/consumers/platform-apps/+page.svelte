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
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { AppWindow, CircleHelp } from "@lucide/svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { checkRoles } from "$lib/utils/roleChecker";
  import type { PlatformApp, PlatformAppScope } from "$lib/server/platformApps";

  let { data } = $props();

  function holds(role: string, bankId?: string, jit = page.data.jitEnabled ?? false): boolean {
    return checkRoles(page.data.userEntitlements ?? [], [{ role, bankId }], bankId, "OR", jit).hasAllRoles;
  }
  let canMark = $derived(holds("CanCreatePlatformApp"));
  let canUnmark = $derived(holds("CanDeletePlatformApp"));
  // CanCreateScopeAtAnyBank anywhere, or CanCreateScopeAtOneBank at the Scope's bank id.
  // JIT is not counted: Create Scope checks its granting Roles in the handler, without JIT.
  function canGrantAt(bankId: string): boolean {
    return holds("CanCreateScopeAtAnyBank", undefined, false) || (bankId !== "" && holds("CanCreateScopeAtOneBank", bankId, false));
  }
  let missingScopes = $derived(data.apps.flatMap((a: PlatformApp) => a.required_scopes.filter((s) => !s.held)));
  // Missing system Scopes need CanCreateScopeAtAnyBank; bank Scopes can also be added with CanCreateScopeAtOneBank at that bank.
  let systemGrantBlocked = $derived(missingScopes.some((s) => s.bank_id === "" && !canGrantAt(s.bank_id)));
  let blockedBankIds = $derived([...new Set(missingScopes.filter((s) => s.bank_id !== "" && !canGrantAt(s.bank_id)).map((s) => s.bank_id))]);

  let busy = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let markForm = $state({ consumer_id: "", label: "" });

  async function call(key: string, url: string, method: string, body?: unknown) {
    busy = key;
    actionError = null;
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const answer = await response.json().catch(() => ({}));
        throw new Error(answer.message ?? `${method} failed (${response.status})`);
      }
      await invalidateAll();
      return true;
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      busy = null;
    }
  }

  async function mark(event: SubmitEvent) {
    event.preventDefault();
    const ok = await call("mark", "/proxy/obp/v7.0.0/management/platform-apps", "POST", {
      consumer_id: markForm.consumer_id.trim(),
      label: markForm.label.trim(),
    });
    if (ok) markForm = { consumer_id: "", label: "" };
  }

  function unmark(app: PlatformApp) {
    call(`unmark-${app.consumer_id}`, `/proxy/obp/v7.0.0/management/platform-apps/${encodeURIComponent(app.consumer_id)}`, "DELETE");
  }

  function grant(app: PlatformApp, s: PlatformAppScope) {
    call(`grant-${app.consumer_id}-${s.role_name}-${s.bank_id}`,
      `/proxy/obp/v7.0.0/consumers/${encodeURIComponent(app.consumer_id)}/scopes`, "POST",
      { bank_id: s.bank_id, role_name: s.role_name });
  }

  function formatDate(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  const STATE_TEXT = { ok: "All required Scopes held", missing: "Scopes missing", not_declared: "Not declared yet" };
  const STATE_CLASS = {
    ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    missing: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    not_declared: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
</script>

<svelte:head>
  <title>Platform Apps - API Manager II</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex items-center justify-between gap-4">
    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
      <AppWindow size={28} /> Platform Apps
    </h1>
    <a
      href="/consumers/platform-apps/help"
      class="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
      data-testid="platform-apps-help-link"
    >
      <CircleHelp size={16} /> Help
    </a>
  </div>

  {#if data.loadError}
    <p class="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="platform-apps-load-error">
      {data.loadError}
    </p>
  {/if}

  {#if actionError}
    <p class="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="platform-apps-action-error">
      {actionError}
    </p>
  {/if}

  {#if systemGrantBlocked}
    <div class="mb-6" data-testid="platform-apps-grant-forbidden">
      <MissingRoleAlert roles={["CanCreateScopeAtAnyBank"]} message="You need this role to add the missing Scopes" />
    </div>
  {/if}
  {#each blockedBankIds as bankId (bankId)}
    <div class="mb-6" data-testid="platform-apps-grant-forbidden-{bankId}">
      <MissingRoleAlert roles={["CanCreateScopeAtOneBank"]} {bankId} message="You need this role to add the missing Scopes at {bankId}" />
    </div>
  {/each}

  <div class="space-y-6">
    {#each data.apps as app (app.consumer_id)}
      <section
        class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        data-testid="platform-app-{app.consumer_id}"
        data-state={app.state}
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5 pb-3">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{app.label}</h2>
          <div class="flex items-center gap-3">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-medium {STATE_CLASS[app.state]}" data-testid="platform-app-{app.consumer_id}-state">
              {STATE_TEXT[app.state]}
            </span>
            {#if canUnmark}
              <button
                type="button"
                onclick={() => unmark(app)}
                disabled={busy !== null}
                class="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                data-testid="platform-app-{app.consumer_id}-unmark"
              >
                Unmark
              </button>
            {/if}
          </div>
        </div>

        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-6 pb-4 text-sm text-gray-700 dark:text-gray-300">
          <dt class="font-medium">Consumer</dt>
          <dd>
            {app.consumer_name}
            <a class="ml-1 font-mono underline" href="/consumers/{encodeURIComponent(app.consumer_id)}/edit">{app.consumer_id}</a>
          </dd>
          {#if app.version}
            <dt class="font-medium">Version</dt>
            <dd class="font-mono">{app.version}</dd>
          {/if}
          <dt class="font-medium">Declared</dt>
          <dd>{app.declared_at ? formatDate(app.declared_at) : "not yet: the app declares its Scopes within a minute of being marked"}</dd>
        </dl>

        {#if app.required_scopes.length > 0}
          <div class="overflow-x-auto">
            <table class="w-full text-sm" data-testid="platform-app-{app.consumer_id}-scopes">
              <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                <tr>
                  <th class="px-6 py-3">Scope</th>
                  <th class="px-6 py-3">Needed for</th>
                  <th class="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each app.required_scopes as scope (scope.role_name + "|" + scope.bank_id)}
                  {@const key = `grant-${app.consumer_id}-${scope.role_name}-${scope.bank_id}`}
                  <tr data-testid="platform-app-{app.consumer_id}-scope-{scope.role_name}" data-held={String(scope.held)}>
                    <td class="px-6 py-3 font-mono text-gray-900 dark:text-gray-100">
                      {scope.role_name}{" "}<span class="text-gray-500 dark:text-gray-400">at {scope.bank_id || "(system)"}</span>
                    </td>
                    <td class="px-6 py-3 text-gray-700 dark:text-gray-300">{scope.needed_for}</td>
                    <td class="px-6 py-3 whitespace-nowrap">
                      {#if scope.held}
                        <span class="text-green-700 dark:text-green-400">held</span>
                      {:else}
                        <span class={scope.optional ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}>
                          missing{scope.optional ? " (optional)" : ""}
                        </span>
                        {#if canGrantAt(scope.bank_id)}
                          <button
                            type="button"
                            onclick={() => grant(app, scope)}
                            disabled={busy !== null}
                            class="ml-2 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            data-testid="platform-app-{app.consumer_id}-add-{scope.role_name}"
                            data-state={busy === key ? "submitting" : "idle"}
                          >
                            {busy === key ? "Adding..." : "Add"}
                          </button>
                        {/if}
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else}
      {#if !data.loadError}
        <p class="text-sm text-gray-600 dark:text-gray-400" data-testid="platform-apps-empty">No Consumer is marked as a Platform App yet.</p>
      {/if}
    {/each}
  </div>

  {#if canMark}
    <section class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="platform-apps-mark">
      <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Mark a Consumer as a Platform App</h2>
      {#if data.ownConsumerId}
        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
          This API Manager runs as Consumer <span class="font-mono">{data.ownConsumerId}</span>, which is not marked.
          <button
            type="button"
            class="ml-1 underline"
            onclick={() => (markForm = { consumer_id: data.ownConsumerId, label: "API Manager" })}
            data-testid="platform-apps-mark-self"
          >Fill in</button>
        </p>
      {/if}
      <form class="flex flex-wrap items-end gap-3" onsubmit={mark}>
        <label class="text-sm text-gray-700 dark:text-gray-300">
          consumer_id
          <input name="consumer_id" required bind:value={markForm.consumer_id}
            class="mt-1 block w-96 max-w-full rounded-md border border-gray-300 px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="platform-apps-mark-consumer-id" />
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-300">
          Name
          <input name="label" required maxlength="100" bind:value={markForm.label} placeholder="Portal"
            class="mt-1 block w-56 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="platform-apps-mark-label" />
        </label>
        <button type="submit" disabled={busy !== null}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="platform-apps-mark-submit" data-state={busy === "mark" ? "submitting" : "idle"}>
          Mark
        </button>
      </form>
      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Each app shows the consumer_id it runs as on its own /status page, in the "OBP Consumer scopes" row.
      </p>
    </section>
  {/if}
</div>
