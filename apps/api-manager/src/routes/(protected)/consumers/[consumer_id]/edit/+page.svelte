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
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import ConsumerApiProductSubscriptions from "$lib/components/ConsumerApiProductSubscriptions.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";
  import { toast } from "$lib/utils/toastService";

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.info(`${label} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(`Failed to copy ${label}`);
    }
  }

  let { data, form } = $props();

  let consumer = $derived(data.consumer);
  let scopes = $derived(data.scopes || []);

  $effect(() => {
    if (consumer) {
      const status = consumer.enabled ? "enabled" : "disabled";
      pageDataSummary.set(`Viewing consumer ${consumer.app_name || "unnamed"} (${status}), ${scopes.length} scopes`);
      pageHeading.set(consumer.app_name || "unnamed consumer");
    }
  });
  let availableRoles = $derived(data.availableRoles || []);
  let banks = $derived(data.banks || []);
  const userEntitlements = data.userEntitlements || [];
  const actionRoles = data.actionRoles || {};
  const isCurrentConsumer = data.isCurrentConsumer || false;
  const rateLimitingInfo = data.rateLimitingInfo;
  const activeRateLimits = data.activeRateLimits;

  type PeriodKey = "per_second" | "per_minute" | "per_hour" | "per_day" | "per_week" | "per_month";

  const ratePeriods: Array<{ key: PeriodKey; label: string; limit: number | undefined }> = [
    { key: "per_second", label: "Per Second", limit: activeRateLimits?.active_per_second_rate_limit },
    { key: "per_minute", label: "Per Minute", limit: activeRateLimits?.active_per_minute_rate_limit },
    { key: "per_hour", label: "Per Hour", limit: activeRateLimits?.active_per_hour_rate_limit },
    { key: "per_day", label: "Per Day", limit: activeRateLimits?.active_per_day_rate_limit },
    { key: "per_week", label: "Per Week", limit: activeRateLimits?.active_per_week_rate_limit },
    { key: "per_month", label: "Per Month", limit: activeRateLimits?.active_per_month_rate_limit },
  ];

  function formatLimit(limit: number | undefined): string {
    if (limit === undefined || limit === null || limit < 0) return "Unlimited";
    return limit.toLocaleString();
  }

  // Helper to check if user has a specific role
  function hasRole(roleName: string): boolean {
    return userEntitlements.some((e: any) => e.role_name === roleName);
  }

  // Check which actions the user can perform
  let canEnableDisable = $derived(hasRole(actionRoles.enableDisable?.role));
  let canAddScope = $derived(hasRole(actionRoles.addScope?.role));
  let canDeleteScope = $derived(hasRole(actionRoles.deleteScope?.role));
  let canUpdateRedirectUrl = $derived(hasRole(actionRoles.updateRedirectUrl?.role));

  // Track which action's missing role alert to show (only shown after user tries the action)
  let showMissingRoleFor = $state<string | null>(null);
  let missingRoleBankId = $state<string>("");

  function tryAction(action: string, bankId: string = ""): boolean {
    const roleCheck = {
      enableDisable: canEnableDisable,
      addScope: canAddScope,
      deleteScope: canDeleteScope,
      updateRedirectUrl: canUpdateRedirectUrl,
    }[action];

    if (roleCheck) {
      showMissingRoleFor = null;
      return true; // User has permission, proceed
    }

    // User doesn't have permission, show the alert
    showMissingRoleFor = action;
    missingRoleBankId = bankId;
    return false;
  }

  function dismissMissingRole() {
    showMissingRoleFor = null;
    missingRoleBankId = "";
  }

  let isSubmitting = $state(false);
  let selectedRole = $state("");
  let selectedBankId = $state(currentBank.bankId);
  let showAddScopeForm = $state(false);

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });

  // Editable field states
  let editingField = $state<string | null>(null);
  let editAppName = $state("");
  let editRedirectUrl = $state("");
  let editLogoUrl = $state("");
  let editCertificate = $state("");

  // Filter roles based on whether they require bank_id
  let selectedRoleRequiresBank = $derived(
    availableRoles.find((r: any) => r.role === selectedRole)?.requires_bank_id ?? false
  );

  // Add Scope: type to search the role list (OBP has well over a thousand roles, including
  // the generated dynamic-entity ones). Matching is case-insensitive on any part of the name;
  // words separated by spaces must all match, so "get dynamic portal" finds
  // CanGetDynamicEntityRecord_obp_portal_page.
  let roleSearch = $state("");
  const ROLE_RESULTS_MAX = 30;
  let roleMatches = $derived.by(() => {
    const terms = roleSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [] as any[];
    return availableRoles
      .filter((r: any) => terms.every((t) => String(r.role).toLowerCase().includes(t)))
      .slice(0, ROLE_RESULTS_MAX);
  });
  let roleMatchTotal = $derived.by(() => {
    const terms = roleSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 0;
    return availableRoles.filter((r: any) => terms.every((t) => String(r.role).toLowerCase().includes(t))).length;
  });
  function chooseRole(role: string) {
    selectedRole = role;
    roleSearch = role;
  }
  function onRoleSearchInput() {
    // Typing again clears the choice unless the text is exactly a role name.
    const exact = availableRoles.find((r: any) => r.role === roleSearch.trim());
    selectedRole = exact ? exact.role : "";
  }

  function startEditing(field: string) {
    editingField = field;
    if (field === "name") editAppName = consumer.app_name || "";
    if (field === "redirect_url") editRedirectUrl = consumer.redirect_url || "";
    if (field === "logo_url") editLogoUrl = consumer.logo_url || "";
    if (field === "certificate") editCertificate = consumer.certificate_pem || "";
  }

  function cancelEditing() {
    editingField = null;
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      return dateString;
    }
  }
</script>

<svelte:head>
  <title>{consumer.app_name} - Detail</title>
</svelte:head>

<div class="mb-6">
  <a
    href="/consumers"
    class="text-sm ui-link"
  >
    &larr; Back to Consumers
  </a>
</div>

<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
  <h1 class="text-2xl font-bold ui-text">
    {consumer.app_name} - Detail
    {#if isCurrentConsumer}
      <span data-testid="current-consumer-marker" class="ml-2 text-base font-normal ui-link">(the current consumer)</span>
    {/if}
  </h1>
  <a
    data-testid="view-metrics-link"
    href="/metrics?consumer_id={consumer.consumer_id}"
    class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-4 preset-filled-primary-500"
  >
    <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    View Metrics
  </a>
</div>

<!-- Error/Success Messages -->
{#if form?.error}
  <div
    class="mb-6 rounded-lg border p-4 ui-tone-error"
  >
    <div class="flex items-start">
      <svg
        class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ui-text-error"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <div>
        <h3 class="text-sm font-medium ui-text-error">Error</h3>
        <p class="mt-1 text-sm ui-text-error">{form.error}</p>
      </div>
    </div>
  </div>
{/if}

{#if form?.success}
  <div
    class="mb-6 rounded-lg border p-4 ui-tone-success"
  >
    <div class="flex items-start">
      <svg
        class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ui-text-success"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
      </svg>
      <div>
        <h3 class="text-sm font-medium ui-text-success">Success</h3>
        <p class="mt-1 text-sm ui-text-success">Changes saved successfully.</p>
      </div>
    </div>
  </div>
{/if}

<!-- Consumer / Client Section -->
<div class="mb-8 rounded-lg border p-6 shadow-sm ui-card ui-border">
  <h2 class="text-lg font-semibold mb-4 ui-text">
    Consumer / Client
  </h2>

  <!-- Editable fields in 2-column grid -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4 pb-4 border-b ui-border">
    <!-- Name (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium ui-muted">Name</label>
        {#if editingField !== "name"}
          <button
            type="button"
            onclick={() => startEditing("name")}
            class="text-xs ui-link"
          >
            Edit
          </button>
        {/if}
      </div>
      {#if editingField === "name"}
        <form
          method="POST"
          action="?/updateName"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              await invalidateAll();
              isSubmitting = false;
              editingField = null;
            };
          }}
          class="mt-1"
        >
          <input
            type="text"
            name="app_name"
            bind:value={editAppName}
            required
            class="w-full rounded border px-2 py-1 text-sm focus:ring-1 ui-card ui-text ui-border"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 preset-filled-primary-500">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border px-2 py-0.5 text-xs font-medium ui-hover ui-muted ui-border">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 ui-text">{consumer.app_name}</p>
      {/if}
    </div>

    <!-- Redirect URL (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium ui-muted">Redirect URL</label>
        {#if editingField !== "redirect_url"}
          <button
            type="button"
            onclick={() => { startEditing("redirect_url"); dismissMissingRole(); }}
            class="text-xs ui-link"
          >
            Edit
          </button>
        {/if}
      </div>
      {#if editingField === "redirect_url"}
        {#if showMissingRoleFor === "updateRedirectUrl"}
          <div class="mt-1 mb-2">
            <MissingRoleAlert
              roles={[actionRoles.updateRedirectUrl?.role]}
              message={`You need the ${actionRoles.updateRedirectUrl?.role} role to ${actionRoles.updateRedirectUrl?.action}`}
            />
          </div>
        {/if}
        <form
          method="POST"
          action="?/updateRedirectUrl"
          use:enhance={() => {
            if (!tryAction("updateRedirectUrl")) {
              return async () => {}; // Cancel form submission
            }
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              await invalidateAll();
              isSubmitting = false;
              editingField = null;
            };
          }}
          class="mt-1"
        >
          <input
            type="url"
            name="redirect_url"
            bind:value={editRedirectUrl}
            required
            placeholder="https://example.com/callback"
            class="w-full rounded border px-2 py-1 text-sm focus:ring-1 ui-card ui-text ui-border"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 preset-filled-primary-500">Save</button>
            <button type="button" onclick={() => { cancelEditing(); dismissMissingRole(); }} class="rounded border px-2 py-0.5 text-xs font-medium ui-hover ui-muted ui-border">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 text-sm break-all ui-text">{consumer.redirect_url || "N/A"}</p>
      {/if}
    </div>

    <!-- Logo URL (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium ui-muted">Logo URL</label>
        {#if editingField !== "logo_url"}
          <button
            type="button"
            onclick={() => startEditing("logo_url")}
            class="text-xs ui-link"
          >
            Edit
          </button>
        {/if}
      </div>
      {#if editingField === "logo_url"}
        <form
          method="POST"
          action="?/updateLogoUrl"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              await invalidateAll();
              isSubmitting = false;
              editingField = null;
            };
          }}
          class="mt-1"
        >
          <input
            type="url"
            name="logo_url"
            bind:value={editLogoUrl}
            placeholder="https://example.com/logo.png"
            class="w-full rounded border px-2 py-1 text-sm focus:ring-1 ui-card ui-text ui-border"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 preset-filled-primary-500">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border px-2 py-0.5 text-xs font-medium ui-hover ui-muted ui-border">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 text-sm break-all ui-text">{consumer.logo_url || "Not set"}</p>
      {/if}
    </div>

    <!-- Certificate (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium ui-muted">Certificate (PEM)</label>
        {#if editingField !== "certificate"}
          <button
            type="button"
            onclick={() => startEditing("certificate")}
            class="text-xs ui-link"
          >
            Edit
          </button>
        {/if}
      </div>
      {#if editingField === "certificate"}
        <form
          method="POST"
          action="?/updateCertificate"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              await invalidateAll();
              isSubmitting = false;
              editingField = null;
            };
          }}
          class="mt-1"
        >
          <textarea
            name="certificate_pem"
            bind:value={editCertificate}
            rows="3"
            placeholder="-----BEGIN CERTIFICATE-----"
            class="w-full rounded border px-2 py-1 font-mono text-xs focus:ring-1 ui-card ui-text ui-border"
          ></textarea>
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 preset-filled-primary-500">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border px-2 py-0.5 text-xs font-medium ui-hover ui-muted ui-border">Cancel</button>
          </div>
          <p class="mt-1 text-xs ui-text-warning">Warning: May disable consumer</p>
        </form>
      {:else}
        <p class="mt-1 text-sm ui-text">{consumer.certificate_pem ? "Configured" : "Not set"}</p>
      {/if}
    </div>
  </div>

  <!-- Read-only fields -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div>
      <label class="block text-sm font-medium ui-muted">App Type</label>
      <p class="mt-1 ui-text">{consumer.app_type}</p>
    </div>
    <div>
      <label class="block text-sm font-medium ui-muted">Developer Email</label>
      <div class="mt-1 flex items-center gap-2">
        <a
          data-testid="developer-email-link"
          href="mailto:{consumer.developer_email}"
          class="hover:underline break-all ui-link"
        >{consumer.developer_email}</a>
        <button
          type="button"
          data-testid="copy-developer-email"
          aria-label="Copy developer email"
          title="Copy email"
          onclick={() => copyToClipboard(consumer.developer_email, "Developer email")}
          class="inline-flex items-center rounded p-1 ui-hover ui-muted"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium ui-muted">Company</label>
      <p class="mt-1 ui-text">{consumer.company || "N/A"}</p>
    </div>
    <div>
      <label class="block text-sm font-medium ui-muted">Description</label>
      <p class="mt-1 ui-text">{consumer.description || "N/A"}</p>
    </div>
    <div>
      <label class="block text-sm font-medium ui-muted">Consumer ID</label>
      <p class="mt-1 font-mono text-sm ui-text">{consumer.consumer_id}</p>
    </div>
    <div>
      <label class="block text-sm font-medium ui-muted">Created</label>
      <p class="mt-1 ui-text">{formatDate(consumer.created)}</p>
    </div>
  </div>
</div>

<!-- Enable/Disable Section -->
<div class="mb-8 rounded-lg border p-6 shadow-sm ui-card ui-border">
  <h2 class="text-lg font-semibold mb-4 ui-text">
    Consumer Status
  </h2>

  <div class="flex items-center justify-between">
    <div>
      <p class="ui-text">
        Status:
        {#if consumer.enabled}
          <span class="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ui-tone-success">
            Enabled
          </span>
        {:else}
          <span class="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ui-tone-error">
            Disabled
          </span>
        {/if}
      </p>
      <p class="mt-1 text-sm ui-muted">
        {consumer.enabled ? "This consumer can access the API." : "This consumer cannot access the API."}
      </p>
    </div>

    <form
      method="POST"
      action="?/toggleEnabled"
      use:enhance={() => {
        if (!tryAction("enableDisable")) {
          return async () => {}; // Cancel form submission
        }
        isSubmitting = true;
        return async ({ update }) => {
          await update();
          await invalidateAll();
          isSubmitting = false;
        };
      }}
    >
      <input type="hidden" name="enabled" value={consumer.enabled ? "false" : "true"} />
      <button
        type="submit"
        disabled={isSubmitting}
        class={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${
          consumer.enabled
            ? "preset-filled-error-500"
            : "preset-filled-primary-500"
        }`}
      >
        {#if isSubmitting}
          <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Updating...
        {:else}
          {consumer.enabled ? "Disable Consumer" : "Enable Consumer"}
        {/if}
      </button>
    </form>
  </div>

  {#if showMissingRoleFor === "enableDisable"}
    <div class="mt-4">
      <MissingRoleAlert
        roles={[actionRoles.enableDisable?.role]}
        message={`You need the ${actionRoles.enableDisable?.role} role to ${actionRoles.enableDisable?.action}`}
      />
    </div>
  {/if}
</div>

<!-- Rate Limits & Usage Section -->
<div data-testid="rate-limits-and-usage" class="mb-8 rounded-lg border p-6 shadow-sm ui-card ui-border">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h2 class="text-lg font-semibold ui-text">
      Rate Limits &amp; Usage
    </h2>
    <a
      data-testid="manage-rate-limits-link"
      href="/consumers/{consumer.consumer_id}/rate-limits"
      class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-4 preset-filled-primary-500"
    >
      Manage Rate Limits
      <svg class="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  </div>
  <p class="mb-2 text-sm ui-muted">
    Current usage against the active rate limit for each period. Shown as <code>calls / limit</code>.
  </p>
  {#if rateLimitingInfo}
    <p class="mb-4 text-[11px] ui-muted">
      Rate limiting: {rateLimitingInfo.enabled ? 'enabled' : 'disabled'}
      {#if rateLimitingInfo.enabled}
        • {rateLimitingInfo.is_active ? 'active' : 'inactive'}
        {#if rateLimitingInfo.technology}
          • backend: {rateLimitingInfo.technology}
        {/if}
        {#if rateLimitingInfo.service_available !== undefined}
          • service: {rateLimitingInfo.service_available ? 'available' : 'unavailable'}
        {/if}
      {/if}
    </p>
  {/if}
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
    {#each ratePeriods as period}
      {@const counter = consumer.call_counters?.[period.key]}
      <div data-testid="rate-usage-{period.key}" class="rounded-lg p-3 ui-card">
        <div class="text-xs font-medium ui-muted">{period.label}</div>
        {#if counter && typeof counter.calls_made === 'number'}
          <div class="mt-1 text-lg font-semibold ui-text">
            {counter.calls_made.toLocaleString()}
            <span class="text-sm font-normal ui-muted">/ {formatLimit(period.limit)}</span>
          </div>
          <div class="text-[10px] ui-muted">resets: {counter.reset_in_seconds}s</div>
          <div class="text-[10px] ui-muted">{counter.status || ''}</div>
        {:else}
          <div class="mt-1 text-lg font-semibold ui-text">
            <span class="ui-text-error">Err</span>
            <span class="text-sm font-normal ui-muted">/ {formatLimit(period.limit)}</span>
          </div>
          <div class="text-[10px] ui-muted">unavailable</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<ConsumerApiProductSubscriptions consumerId={consumer.consumer_id} />

<!-- Scopes Section -->
<div class="rounded-lg border p-6 shadow-sm ui-card ui-border">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold ui-text">
      Consumer Scopes
    </h2>
    <button
      type="button"
      onclick={() => { showAddScopeForm = !showAddScopeForm; dismissMissingRole(); }}
      class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-4 preset-filled-primary-500"
    >
      {showAddScopeForm ? "Cancel" : "Add Scope"}
    </button>
  </div>

  <p class="mb-4 text-sm ui-muted">
    Scopes grant roles to this consumer. System-level roles have an empty bank_id. Bank-level roles are scoped to a specific bank.
  </p>

  <!-- Add Scope Form -->
  {#if showAddScopeForm}
    <div class="mb-6 rounded-lg border p-4 ui-tone-info">
      <h3 class="text-sm font-medium mb-3 ui-link">Add New Scope</h3>

      {#if showMissingRoleFor === "addScope"}
        <div class="mb-4">
          <MissingRoleAlert
            roles={[actionRoles.addScope?.role]}
            bankId={missingRoleBankId}
            message={`You need the ${actionRoles.addScope?.role} role to ${actionRoles.addScope?.action}`}
          />
        </div>
      {/if}

      <form
        method="POST"
        action="?/addScope"
        use:enhance={() => {
          if (!tryAction("addScope", selectedBankId)) {
            return async () => {}; // Cancel form submission
          }
          isSubmitting = true;
          return async ({ update }) => {
            await update();
            await invalidateAll();
            isSubmitting = false;
            selectedRole = "";
            roleSearch = "";
            showAddScopeForm = false;
          };
        }}
        class="space-y-4"
      >
        <div>
          <label for="role_name" class="block text-sm font-medium mb-1 ui-text">
            Role <span class="ui-text-error">*</span>
          </label>
          <input type="hidden" name="role_name" value={selectedRole} />
          <input
            id="role_name"
            type="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Type part of the role name, e.g. get consumer, or dynamic portal"
            bind:value={roleSearch}
            oninput={onRoleSearchInput}
            class="w-full rounded-lg border px-4 py-2 font-mono text-sm focus:ring-2 ui-card ui-text ui-border"
            data-testid="scope-role-search"
            aria-controls="role-search-results"
            aria-describedby="role-search-hint"
          />
          <p id="role-search-hint" class="mt-1 text-xs ui-muted">
            {#if selectedRole}
              Selected <code>{selectedRole}</code>{selectedRoleRequiresBank ? " (bank-level)" : " (system-level)"}.
            {:else if roleSearch.trim()}
              {roleMatchTotal} of {availableRoles.length} roles match{roleMatchTotal > ROLE_RESULTS_MAX ? `, showing the first ${ROLE_RESULTS_MAX}` : ""}. Pick one below.
            {:else}
              {availableRoles.length} roles available. Words separated by spaces must all appear in the name.
            {/if}
          </p>
          {#if !selectedRole && roleMatches.length > 0}
            <ul
              id="role-search-results"
              role="listbox"
              class="mt-2 max-h-64 divide-y overflow-auto rounded-lg border ui-card ui-border"
              data-testid="scope-role-results"
            >
              {#each roleMatches as role (role.role)}
                <li role="option" aria-selected="false">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm focus:outline-none ui-hover"
                    onclick={() => chooseRole(role.role)}
                    data-testid="scope-role-option"
                  >
                    <span class="font-mono ui-text">{role.role}</span>
                    <span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs {role.requires_bank_id ? 'ui-tone-warning' : 'ui-panel ui-muted'}">
                      {role.requires_bank_id ? "Bank" : "System"}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else if !selectedRole && roleSearch.trim() && roleMatches.length === 0}
            <p class="mt-2 text-sm ui-muted">No role matches. Dynamic-entity roles look like <code>CanGetDynamicEntityRecord_&lt;entity&gt;</code>.</p>
          {/if}
        </div>

        {#if selectedRoleRequiresBank}
          <input type="hidden" name="bank_id" value={selectedBankId} />
          <div>
            <label class="block text-sm font-medium mb-1 ui-text">
              Bank
            </label>
            {#if selectedBankId}
              <div class="rounded-lg border px-4 py-2 ui-card ui-muted ui-border">
                {selectedBankId}
              </div>
            {:else}
              <div class="text-sm ui-text-warning">
                Please select a bank in <a href="/user" class="underline">My Account</a> first.
              </div>
            {/if}
          </div>
        {:else}
          <input type="hidden" name="bank_id" value="" />
        {/if}

        <div class="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !selectedRole}
            class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 preset-filled-primary-500"
          >
            {#if isSubmitting}
              <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            {:else}
              Add Scope
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { showAddScopeForm = false; selectedRole = ""; roleSearch = ""; }}
            class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Scopes List -->
  {#if scopes.length > 0}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y ui-border">
        <thead class="ui-card">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">
              Role Name
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">
              Bank ID
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">
              Scope ID
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y ui-card ui-border">
          {#each scopes as scope}
            <tr class="ui-hover">
              <td class="whitespace-nowrap px-4 py-3 text-sm font-medium ui-text">
                {scope.role_name}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">
                {scope.bank_id || "(System-level)"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs ui-muted">
                {scope.scope_id}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <form
                  method="POST"
                  action="?/deleteScope"
                  use:enhance={() => {
                    if (!tryAction("deleteScope", scope.bank_id || "")) {
                      return async () => {}; // Cancel - show missing role alert
                    }
                    if (!confirm(`Are you sure you want to delete the scope "${scope.role_name}"?`)) {
                      return async () => {};
                    }
                    isSubmitting = true;
                    return async ({ update }) => {
                      await update();
                      await invalidateAll();
                      isSubmitting = false;
                    };
                  }}
                  class="inline"
                >
                  <input type="hidden" name="scope_id" value={scope.scope_id} />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    class="disabled:opacity-50 ui-text-error"
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="rounded-lg border-2 border-dashed p-8 text-center ui-border">
      <svg
        class="mx-auto h-12 w-12 ui-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium ui-text">No scopes</h3>
      <p class="mt-1 text-sm ui-muted">
        This consumer has no scopes assigned. Add a scope to grant it specific roles.
      </p>
    </div>
  {/if}

  {#if showMissingRoleFor === "deleteScope"}
    <div class="mt-4">
      <MissingRoleAlert
        roles={[actionRoles.deleteScope?.role]}
        bankId={missingRoleBankId}
        message={`You need the ${actionRoles.deleteScope?.role} role to ${actionRoles.deleteScope?.action}`}
      />
    </div>
  {/if}
</div>
