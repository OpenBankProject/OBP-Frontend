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
  .breadcrumb-link { color: #667eea; text-decoration: none; }
  .breadcrumb-link:hover { text-decoration: underline; }
  :global([data-mode="dark"]) .breadcrumb-link { color: rgb(var(--color-primary-400)); }
  .breadcrumb-separator { color: #9ca3af; }
  .breadcrumb-current { color: #6b7280; }
  :global([data-mode="dark"]) .breadcrumb-current { color: var(--color-surface-400); }

  .panel { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  :global([data-mode="dark"]) .panel { background: rgb(var(--color-surface-800)); }

  .panel-header { padding: 1.25rem; border-bottom: 1px solid #e5e7eb; }
  :global([data-mode="dark"]) .panel-header { border-bottom-color: rgb(var(--color-surface-700)); }

  .header-row { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
  :global([data-mode="dark"]) .panel-title { color: var(--color-surface-100); }
  .panel-subtitle { font-size: 0.813rem; color: #6b7280; margin-top: 0.25rem; }
  :global([data-mode="dark"]) .panel-subtitle { color: var(--color-surface-400); }

  .panel-content { padding: 1.25rem; }

  .form-row { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem; }

  .btn-grant {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 1.25rem; border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer;
    color: white; white-space: nowrap; transition: background 0.2s;
  }
  .btn-bank { background: #6366f1; }
  .btn-bank:hover:not(:disabled) { background: #4f46e5; }
  .btn-system { background: #0ea5e9; }
  .btn-system:hover:not(:disabled) { background: #0284c7; }
  .btn-grant:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-grant :global(.spinner-icon) { animation: spin 1s linear infinite; }

  .notice {
    padding: 0.75rem 1rem; background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 6px; font-size: 0.813rem; color: #92400e; margin-bottom: 1rem;
  }
  :global([data-mode="dark"]) .notice {
    background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: rgb(var(--color-warning-300));
  }

  .results-summary {
    display: flex; gap: 1rem; padding: 0.75rem 1rem; background: #f9fafb;
    border-radius: 6px; margin-bottom: 0.75rem; font-size: 0.813rem; font-weight: 500;
  }
  :global([data-mode="dark"]) .results-summary { background: rgb(var(--color-surface-700)); }
  .summary-item.success { color: #16a34a; }
  .summary-item.skipped { color: #d97706; }
  .summary-item.error { color: #dc2626; }
  .summary-item.pending { color: #6b7280; }
  :global([data-mode="dark"]) .summary-item.success { color: rgb(var(--color-success-400)); }
  :global([data-mode="dark"]) .summary-item.skipped { color: rgb(var(--color-warning-400)); }
  :global([data-mode="dark"]) .summary-item.error { color: rgb(var(--color-error-400)); }
  :global([data-mode="dark"]) .summary-item.pending { color: var(--color-surface-400); }

  .results-list {
    max-height: 500px; overflow-y: auto;
    border: 1px solid #e5e7eb; border-radius: 6px;
  }
  :global([data-mode="dark"]) .results-list { border-color: rgb(var(--color-surface-600)); }

  .result-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.375rem 0.75rem; font-size: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }
  :global([data-mode="dark"]) .result-row { border-bottom-color: rgb(var(--color-surface-700)); }
  .result-row:last-child { border-bottom: none; }

  .result-row[data-state="success"] .result-icon { color: #16a34a; }
  .result-row[data-state="skipped"] .result-icon { color: #d97706; }
  .result-row[data-state="error"] .result-icon { color: #dc2626; }
  .result-row[data-state="pending"] .result-icon { color: #6b7280; }

  .result-role { font-family: monospace; flex: 1; }
  :global([data-mode="dark"]) .result-role { color: var(--color-surface-200); }

  .result-message { color: #6b7280; font-size: 0.7rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global([data-mode="dark"]) .result-message { color: var(--color-surface-400); }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
