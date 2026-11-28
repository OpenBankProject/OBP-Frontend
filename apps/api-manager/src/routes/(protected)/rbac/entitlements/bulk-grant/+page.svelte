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
  import { Loader2, Check, X, Zap } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import UserSearchPickerWidget from "$lib/components/UserSearchPickerWidget.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  let bankRoles = $derived((data as any).bankRoles || []);
  let systemRoles = $derived((data as any).systemRoles || []);

  let userId = $state("");
  let username = $state("");
  let bankId = $derived(currentBank.bankId);

  let isGranting = $state(false);
  let results = $state<Array<{ role: string; status: "pending" | "success" | "error" | "skipped"; message?: string }>>([]);

  let successCount = $derived(results.filter((r) => r.status === "success").length);
  let skippedCount = $derived(results.filter((r) => r.status === "skipped").length);
  let errorCount = $derived(results.filter((r) => r.status === "error").length);
  let pendingCount = $derived(results.filter((r) => r.status === "pending").length);

  function handleUserSelect(user: any) {
    userId = user.user_id;
    username = user.username;
    results = [];
  }

  async function grantRoles(roles: Array<{ role: string }>, useBankId: string) {
    if (!userId.trim()) {
      toast.error("Validation Error", "Select a user first");
      return;
    }

    isGranting = true;
    results = roles.map((r) => ({ role: r.role, status: "pending" as const }));

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      try {
        const res = await trackedFetch("/backend/rbac/entitlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId.trim(),
            role_name: role.role,
            bank_id: useBankId,
          }),
        });

        if (res.ok) {
          results[i] = { role: role.role, status: "success" };
        } else {
          const err = await res.json().catch(() => ({}));
          const msg = err.error || "Failed";
          if (msg.includes("already has the entitlement") || msg.includes("Duplicate") || res.status === 409) {
            results[i] = { role: role.role, status: "skipped", message: "Already granted" };
          } else {
            results[i] = { role: role.role, status: "error", message: msg };
          }
        }
      } catch (err) {
        results[i] = { role: role.role, status: "error", message: err instanceof Error ? err.message : "Failed" };
      }
    }

    isGranting = false;
    toast.success(
      "Bulk Grant Complete",
      `${successCount} granted, ${skippedCount} already existed, ${errorCount} failed`
    );
  }

  function grantAllBankRoles() {
    if (!bankId) {
      toast.error("Validation Error", "Select a bank first");
      return;
    }
    if (!confirm(`Grant ${bankRoles.length} bank roles to ${username}?`)) return;
    grantRoles(bankRoles, bankId);
  }

  function grantAllSystemRoles() {
    if (!confirm(`Grant ${systemRoles.length} system roles to ${username}?`)) return;
    grantRoles(systemRoles, "");
  }
</script>

<svelte:head>
  <title>Bulk Grant Entitlements - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/rbac/entitlements" class="breadcrumb-link">Entitlements</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">Bulk Grant</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-row">
        <div>
          <h1 class="panel-title">Bulk Grant Roles</h1>
          <p class="panel-subtitle">
            {bankRoles.length} bank-level roles, {systemRoles.length} system-level roles
          </p>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div class="form-row">
        <UserSearchPickerWidget
          onSelect={handleUserSelect}
          bind:selectedUserId={userId}
          bind:selectedUsername={username}
          disabled={isGranting}
        />

        <button
          type="button"
          class="btn-grant btn-bank"
          disabled={isGranting || !userId || !bankId}
          onclick={grantAllBankRoles}
          data-testid="bulk-grant-bank-button"
        >
          {#if isGranting && results.length === bankRoles.length}
            <Loader2 size={16} class="spinner-icon" />
            Granting... ({pendingCount} remaining)
          {:else}
            <Zap size={16} />
            Grant {bankRoles.length} Bank Roles
          {/if}
        </button>

        <button
          type="button"
          class="btn-grant btn-system"
          disabled={isGranting || !userId}
          onclick={grantAllSystemRoles}
          data-testid="bulk-grant-system-button"
        >
          {#if isGranting && results.length === systemRoles.length}
            <Loader2 size={16} class="spinner-icon" />
            Granting... ({pendingCount} remaining)
          {:else}
            <Zap size={16} />
            Grant {systemRoles.length} System Roles
          {/if}
        </button>
      </div>

      {#if !bankId}
        <div class="notice">Select a bank to grant bank-level roles.</div>
      {/if}

      {#if results.length > 0}
        <div class="results-summary">
          <span class="summary-item success">{successCount} granted</span>
          <span class="summary-item skipped">{skippedCount} already existed</span>
          <span class="summary-item error">{errorCount} failed</span>
          {#if pendingCount > 0}
            <span class="summary-item pending">{pendingCount} pending</span>
          {/if}
        </div>

        <div class="results-list">
          {#each results as r}
            <div class="result-row" data-state={r.status} data-testid="result-{r.role}">
              <span class="result-icon">
                {#if r.status === "success"}
                  <Check size={14} />
                {:else if r.status === "skipped"}
                  <Check size={14} />
                {:else if r.status === "error"}
                  <X size={14} />
                {:else}
                  <Loader2 size={14} class="spinner-icon" />
                {/if}
              </span>
              <span class="result-role">{r.role}</span>
              {#if r.message}
                <span class="result-message">{r.message}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container { max-width: 1200px; }

  .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .breadcrumb-link { color: var(--ui-link); text-decoration: none; }
  .breadcrumb-link:hover { text-decoration: underline; }
  .breadcrumb-separator { color: var(--ui-muted); }
  .breadcrumb-current { color: var(--ui-muted); }

  .panel { background: var(--ui-card); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }

  .panel-header { padding: 1.25rem; border-bottom: 1px solid var(--ui-border); }

  .header-row { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
  .panel-subtitle { font-size: 0.813rem; color: var(--ui-muted); margin-top: 0.25rem; }

  .panel-content { padding: 1.25rem; }

  .form-row { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem; }

  .btn-grant {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 1.25rem; border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer;
    color: var(--ui-fill-main-text); white-space: nowrap; transition: background 0.2s;
  }
  .btn-bank { background: var(--ui-fill-main-bg); }
  .btn-bank:hover:not(:disabled) { opacity: 0.85; }
  .btn-system { background: var(--ui-fill-main-bg); }
  .btn-system:hover:not(:disabled) { opacity: 0.85; }
  .btn-grant:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-grant :global(.spinner-icon) { animation: spin 1s linear infinite; }

  .notice {
    padding: 0.75rem 1rem; background: var(--ui-tone-warning-bg); border: 1px solid var(--ui-tone-warning-border);
    border-radius: 6px; font-size: 0.813rem; color: var(--ui-tone-warning-text); margin-bottom: 1rem;
  }

  .results-summary {
    display: flex; gap: 1rem; padding: 0.75rem 1rem; background: var(--ui-card);
    border-radius: 6px; margin-bottom: 0.75rem; font-size: 0.813rem; font-weight: 500;
  }
  .summary-item.success { color: var(--ui-success); }
  .summary-item.skipped { color: var(--ui-warning); }
  .summary-item.error { color: var(--ui-error); }
  .summary-item.pending { color: var(--ui-muted); }

  .results-list {
    max-height: 500px; overflow-y: auto;
    border: 1px solid var(--ui-border); border-radius: 6px;
  }

  .result-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.375rem 0.75rem; font-size: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
  }
  .result-row:last-child { border-bottom: none; }

  .result-row[data-state="success"] .result-icon { color: var(--ui-success); }
  .result-row[data-state="skipped"] .result-icon { color: var(--ui-warning); }
  .result-row[data-state="error"] .result-icon { color: var(--ui-error); }
  .result-row[data-state="pending"] .result-icon { color: var(--ui-muted); }

  .result-role { font-family: monospace; flex: 1; }

  .result-message { color: var(--ui-muted); font-size: 0.7rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
