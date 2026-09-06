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
  import { Loader2, Check, X, Zap, ShieldOff } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import UserSearchPickerWidget from "$lib/components/UserSearchPickerWidget.svelte";

  interface Entitlement {
    entitlement_id: string;
    role_name: string;
    bank_id: string;
  }

  // Roles preserved by "Revoke Most" — these let the user manage entitlements
  const PROTECTED_ROLES = [
    "CanCreateEntitlementAtAnyBank",
    "CanCreateEntitlementAtOneBank",
    "CanDeleteEntitlementAtAnyBank",
    "CanDeleteEntitlementAtOneBank",
  ];

  let userId = $state("");
  let username = $state("");

  let entitlements = $state<Entitlement[]>([]);
  let isLoadingEntitlements = $state(false);

  let isRevoking = $state(false);
  let results = $state<Array<{ role: string; entitlement_id: string; status: "pending" | "success" | "error" | "skipped"; message?: string }>>([]);

  let successCount = $derived(results.filter((r) => r.status === "success").length);
  let skippedCount = $derived(results.filter((r) => r.status === "skipped").length);
  let errorCount = $derived(results.filter((r) => r.status === "error").length);
  let pendingCount = $derived(results.filter((r) => r.status === "pending").length);

  let protectedCount = $derived(entitlements.filter((e) => PROTECTED_ROLES.includes(e.role_name)).length);
  let revocableCount = $derived(entitlements.length - protectedCount);

  async function handleUserSelect(user: any) {
    userId = user.user_id;
    username = user.username;
    results = [];
    await loadEntitlements(user.user_id);
  }

  async function loadEntitlements(uid: string) {
    isLoadingEntitlements = true;
    entitlements = [];

    try {
      const res = await trackedFetch(`/proxy/obp/v6.0.0/users/${encodeURIComponent(uid)}/entitlements`);
      if (res.ok) {
        const data = await res.json();
        entitlements = data.list || [];
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error("Failed to load entitlements", err.error || "Unknown error");
      }
    } catch (err) {
      toast.error("Failed to load entitlements", err instanceof Error ? err.message : "Unknown error");
    } finally {
      isLoadingEntitlements = false;
    }
  }

  async function revokeEntitlements(toRevoke: Entitlement[]) {
    if (!userId.trim()) {
      toast.error("Validation Error", "Select a user first");
      return;
    }

    if (toRevoke.length === 0) {
      toast.error("Nothing to revoke", "No entitlements to revoke");
      return;
    }

    isRevoking = true;
    results = toRevoke.map((e) => ({ role: e.role_name, entitlement_id: e.entitlement_id, status: "pending" as const }));

    for (let i = 0; i < toRevoke.length; i++) {
      const ent = toRevoke[i];
      try {
        if (!ent.entitlement_id) {
          results[i] = { role: ent.role_name, entitlement_id: "", status: "skipped", message: "No entitlement_id — likely a scope on the consumer, not a user entitlement" };
          continue;
        }
        const res = await trackedFetch(`/backend/rbac/entitlements/${encodeURIComponent(ent.entitlement_id)}`, {
          method: "DELETE",
        });

        if (res.ok) {
          results[i] = { role: ent.role_name, entitlement_id: ent.entitlement_id, status: "success" };
        } else {
          // Read body as text first, then try to parse as JSON to preserve the full OBP error
          const text = await res.text().catch(() => "");
          let message: string;
          try {
            const parsed = JSON.parse(text);
            message = parsed.error || parsed.message || text;
          } catch {
            message = text || res.statusText;
          }
          // Always prefix with status code so the user can see what HTTP error OBP returned
          message = `(${res.status}) ${message}`;
          results[i] = { role: ent.role_name, entitlement_id: ent.entitlement_id, status: "error", message };
        }
      } catch (err) {
        results[i] = { role: ent.role_name, entitlement_id: ent.entitlement_id, status: "error", message: err instanceof Error ? err.message : "Failed" };
      }
    }

    isRevoking = false;

    // Reload entitlements to reflect current state
    await loadEntitlements(userId);

    toast.success(
      "Bulk Revoke Complete",
      `${successCount} revoked, ${skippedCount} skipped, ${errorCount} failed`
    );
  }

  function revokeAll() {
    if (!confirm(`Revoke ALL ${entitlements.length} entitlements from ${username}?`)) return;
    revokeEntitlements([...entitlements]);
  }

  function revokeMost() {
    const toRevoke = entitlements.filter((e) => !PROTECTED_ROLES.includes(e.role_name));
    if (!confirm(`Revoke ${toRevoke.length} entitlements from ${username}? (keeping entitlement management roles)`)) return;
    revokeEntitlements(toRevoke);
  }
</script>

<svelte:head>
  <title>Bulk Revoke Entitlements - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/rbac/entitlements" class="breadcrumb-link">Entitlements</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">Bulk Revoke</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-row">
        <div>
          <h1 class="panel-title">Bulk Revoke Roles</h1>
          <p class="panel-subtitle">
            {#if entitlements.length > 0}
              {entitlements.length} entitlement{entitlements.length !== 1 ? "s" : ""} for {username}
            {:else if userId && !isLoadingEntitlements}
              No entitlements found for {username}
            {:else}
              Select a user to view their entitlements
            {/if}
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
          disabled={isRevoking}
        />

        <div class="btn-group">
          <button
            type="button"
            class="btn-revoke btn-revoke-most"
            disabled={isRevoking || !userId || revocableCount === 0}
            onclick={revokeMost}
            data-testid="bulk-revoke-most-button"
          >
            {#if isRevoking && results.length === revocableCount}
              <Loader2 size={16} class="spinner-icon" />
              Revoking... ({pendingCount} remaining)
            {:else if !userId}
              <ShieldOff size={16} />
              Select a user first
            {:else}
              <ShieldOff size={16} />
              Revoke Most ({revocableCount})
            {/if}
          </button>
          <div class="btn-detail">Keeps: {PROTECTED_ROLES.join(", ")}</div>
        </div>

        <div class="btn-group">
          <button
            type="button"
            class="btn-revoke btn-revoke-all"
            disabled={isRevoking || !userId || entitlements.length === 0}
            onclick={revokeAll}
            data-testid="bulk-revoke-all-button"
          >
            {#if isRevoking && results.length === entitlements.length}
              <Loader2 size={16} class="spinner-icon" />
              Revoking... ({pendingCount} remaining)
            {:else if !userId}
              <Zap size={16} />
              Select a user first
            {:else}
              <Zap size={16} />
              Revoke All ({entitlements.length})
            {/if}
          </button>
          <div class="btn-detail">Removes all entitlements including {PROTECTED_ROLES.join(", ")}</div>
        </div>
      </div>

      {#if isLoadingEntitlements}
        <div class="loading-row">
          <Loader2 size={16} class="spinner-icon" /> Loading entitlements...
        </div>
      {/if}

      {#if entitlements.length > 0 && !isRevoking && results.length === 0}
        <div class="notice">
          <strong>Revoke Most</strong> preserves: {PROTECTED_ROLES.join(", ")} — so you keep the ability to manage entitlements.
        </div>

        <div class="entitlements-list">
          {#each entitlements as ent}
            <div
              class="entitlement-row"
              data-protected={PROTECTED_ROLES.includes(ent.role_name) ? "true" : undefined}
              data-testid="entitlement-{ent.role_name}"
            >
              <span class="entitlement-role">{ent.role_name}</span>
              {#if ent.bank_id}
                <span class="entitlement-bank">{ent.bank_id}</span>
              {/if}
              {#if PROTECTED_ROLES.includes(ent.role_name)}
                <span class="protected-badge">kept by Revoke Most</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if results.length > 0}
        <div class="results-summary">
          <span class="summary-item success">{successCount} revoked</span>
          {#if skippedCount > 0}
            <span class="summary-item skipped">{skippedCount} skipped</span>
          {/if}
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

  .btn-group { display: flex; flex-direction: column; gap: 0.25rem; }
  .btn-detail { font-size: 0.7rem; color: #6b7280; max-width: 280px; line-height: 1.3; }
  :global([data-mode="dark"]) .btn-detail { color: var(--color-surface-400); }

  .btn-revoke {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 1.25rem; border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer;
    color: white; white-space: nowrap; transition: background 0.2s;
  }
  .btn-revoke-most { background: #f59e0b; }
  .btn-revoke-most:hover:not(:disabled) { background: #d97706; }
  .btn-revoke-all { background: #dc2626; }
  .btn-revoke-all:hover:not(:disabled) { background: #b91c1c; }
  .btn-revoke:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-revoke :global(.spinner-icon) { animation: spin 1s linear infinite; }

  .loading-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 0; font-size: 0.875rem; color: #6b7280;
  }
  .loading-row :global(.spinner-icon) { animation: spin 1s linear infinite; }
  :global([data-mode="dark"]) .loading-row { color: var(--color-surface-400); }

  .notice {
    padding: 0.75rem 1rem; background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 6px; font-size: 0.813rem; color: #92400e; margin-bottom: 1rem;
  }
  :global([data-mode="dark"]) .notice {
    background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: rgb(var(--color-warning-300));
  }

  .entitlements-list {
    max-height: 500px; overflow-y: auto;
    border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 1rem;
  }
  :global([data-mode="dark"]) .entitlements-list { border-color: rgb(var(--color-surface-600)); }

  .entitlement-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.375rem 0.75rem; font-size: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }
  :global([data-mode="dark"]) .entitlement-row { border-bottom-color: rgb(var(--color-surface-700)); }
  .entitlement-row:last-child { border-bottom: none; }
  .entitlement-row[data-protected="true"] { background: #fefce8; }
  :global([data-mode="dark"]) .entitlement-row[data-protected="true"] { background: rgba(245,158,11,0.05); }

  .entitlement-role { font-family: monospace; flex: 1; }
  :global([data-mode="dark"]) .entitlement-role { color: var(--color-surface-200); }

  .entitlement-bank { color: #6b7280; font-size: 0.7rem; }
  :global([data-mode="dark"]) .entitlement-bank { color: var(--color-surface-400); }

  .protected-badge {
    font-size: 0.65rem; padding: 0.125rem 0.5rem; border-radius: 999px;
    background: #fef3c7; color: #92400e; font-weight: 500;
  }
  :global([data-mode="dark"]) .protected-badge {
    background: rgba(245,158,11,0.15); color: rgb(var(--color-warning-300));
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

  .result-message { color: #6b7280; font-size: 0.75rem; }
  :global([data-mode="dark"]) .result-message { color: var(--color-surface-400); }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
