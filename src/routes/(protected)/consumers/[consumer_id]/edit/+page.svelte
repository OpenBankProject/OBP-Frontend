<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let { data, form } = $props();

  let consumer = $derived(data.consumer);
  let scopes = $derived(data.scopes || []);

  $effect(() => {
    if (consumer) {
      const status = consumer.enabled ? "enabled" : "disabled";
      pageDataSummary.set(`Viewing consumer ${consumer.app_name || consumer.consumer_id} (${status}), ${scopes.length} scopes`);
      pageHeading.set(consumer.app_name || consumer.consumer_id);
    }
  });
  let availableRoles = $derived(data.availableRoles || []);
  let banks = $derived(data.banks || []);
  const userEntitlements = data.userEntitlements || [];
  const actionRoles = data.actionRoles || {};
  const isCurrentConsumer = data.isCurrentConsumer || false;
  const rateLimitingInfo = data.rateLimitingInfo;

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
    class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
  >
    &larr; Back to Consumers
  </a>
</div>

<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
  {consumer.app_name} - Detail
</h1>

{#if isCurrentConsumer}
  <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
    <div class="flex items-center gap-2">
      <span class="text-blue-600 dark:text-blue-400">ℹ️</span>
      <span class="text-sm font-medium text-blue-800 dark:text-blue-200">This is the current consumer</span>
      <span class="text-xs text-blue-600 dark:text-blue-400">— the app you are using to access the API right now</span>
    </div>
  </div>
{/if}

<!-- Error/Success Messages -->
{#if form?.error}
  <div
    class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
  >
    <div class="flex items-start">
      <svg
        class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
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
        <h3 class="text-sm font-medium text-red-900 dark:text-red-100">Error</h3>
        <p class="mt-1 text-sm text-red-800 dark:text-red-200">{form.error}</p>
      </div>
    </div>
  </div>
{/if}

{#if form?.success}
  <div
    class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
  >
    <div class="flex items-start">
      <svg
        class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
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
        <h3 class="text-sm font-medium text-green-900 dark:text-green-100">Success</h3>
        <p class="mt-1 text-sm text-green-800 dark:text-green-200">Changes saved successfully.</p>
      </div>
    </div>
  </div>
{/if}

<!-- Consumer / Client Section -->
<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    Consumer / Client
  </h2>

  <!-- Editable fields in 2-column grid -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
    <!-- Name (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
        {#if editingField !== "name"}
          <button
            type="button"
            onclick={() => startEditing("name")}
            class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
            class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 text-gray-900 dark:text-gray-100">{consumer.app_name}</p>
      {/if}
    </div>

    <!-- Redirect URL (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Redirect URL</label>
        {#if editingField !== "redirect_url"}
          <button
            type="button"
            onclick={() => { startEditing("redirect_url"); dismissMissingRole(); }}
            class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
            class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button type="button" onclick={() => { cancelEditing(); dismissMissingRole(); }} class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 text-gray-900 dark:text-gray-100 text-sm break-all">{consumer.redirect_url || "N/A"}</p>
      {/if}
    </div>

    <!-- Logo URL (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Logo URL</label>
        {#if editingField !== "logo_url"}
          <button
            type="button"
            onclick={() => startEditing("logo_url")}
            class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
            class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancel</button>
          </div>
        </form>
      {:else}
        <p class="mt-1 text-gray-900 dark:text-gray-100 text-sm break-all">{consumer.logo_url || "Not set"}</p>
      {/if}
    </div>

    <!-- Certificate (Editable) -->
    <div>
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Certificate (PEM)</label>
        {#if editingField !== "certificate"}
          <button
            type="button"
            onclick={() => startEditing("certificate")}
            class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
            class="w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          ></textarea>
          <div class="mt-1 flex gap-1">
            <button type="submit" disabled={isSubmitting} class="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button type="button" onclick={cancelEditing} class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancel</button>
          </div>
          <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">Warning: May disable consumer</p>
        </form>
      {:else}
        <p class="mt-1 text-gray-900 dark:text-gray-100 text-sm">{consumer.certificate_pem ? "Configured" : "Not set"}</p>
      {/if}
    </div>
  </div>

  <!-- Read-only fields -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">App Type</label>
      <p class="mt-1 text-gray-900 dark:text-gray-100">{consumer.app_type}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Developer Email</label>
      <p class="mt-1 text-gray-900 dark:text-gray-100">{consumer.developer_email}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Company</label>
      <p class="mt-1 text-gray-900 dark:text-gray-100">{consumer.company || "N/A"}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
      <p class="mt-1 text-gray-900 dark:text-gray-100">{consumer.description || "N/A"}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Consumer ID</label>
      <p class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{consumer.consumer_id}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
      <p class="mt-1 text-gray-900 dark:text-gray-100">{formatDate(consumer.created)}</p>
    </div>
  </div>
</div>

<!-- Enable/Disable Section -->
<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    Consumer Status
  </h2>

  <div class="flex items-center justify-between">
    <div>
      <p class="text-gray-900 dark:text-gray-100">
        Status:
        {#if consumer.enabled}
          <span class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            Enabled
          </span>
        {:else}
          <span class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
            Disabled
          </span>
        {/if}
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
            ? "bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800"
            : "bg-green-600 hover:bg-green-700 focus:ring-green-300 dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-800"
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

<!-- Call Counters Section -->
<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    API Call Counters
  </h2>
  <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
    Current API usage for this consumer.
  </p>
  {#if rateLimitingInfo}
    <p class="mb-4 text-[11px] text-gray-400 dark:text-gray-500">
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
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Second</div>
      {#if consumer.call_counters?.per_second && typeof consumer.call_counters.per_second.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_second.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_second.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_second.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Minute</div>
      {#if consumer.call_counters?.per_minute && typeof consumer.call_counters.per_minute.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_minute.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_minute.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_minute.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Hour</div>
      {#if consumer.call_counters?.per_hour && typeof consumer.call_counters.per_hour.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_hour.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_hour.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_hour.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Day</div>
      {#if consumer.call_counters?.per_day && typeof consumer.call_counters.per_day.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_day.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_day.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_day.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Week</div>
      {#if consumer.call_counters?.per_week && typeof consumer.call_counters.per_week.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_week.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_week.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_week.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Per Month</div>
      {#if consumer.call_counters?.per_month && typeof consumer.call_counters.per_month.calls_made === 'number'}
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{consumer.call_counters.per_month.calls_made}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">resets: {consumer.call_counters.per_month.reset_in_seconds}s</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">{consumer.call_counters.per_month.status || ''}</div>
      {:else}
        <div class="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">Err</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500">unavailable</div>
      {/if}
    </div>
  </div>
</div>

<!-- Scopes Section -->
<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Consumer Scopes
    </h2>
    <button
      type="button"
      onclick={() => { showAddScopeForm = !showAddScopeForm; dismissMissingRole(); }}
      class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
    >
      {showAddScopeForm ? "Cancel" : "Add Scope"}
    </button>
  </div>

  <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
    Scopes grant roles to this consumer. System-level roles have an empty bank_id. Bank-level roles are scoped to a specific bank.
  </p>

  <!-- Add Scope Form -->
  {#if showAddScopeForm}
    <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">Add New Scope</h3>

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
            showAddScopeForm = false;
          };
        }}
        class="space-y-4"
      >
        <div>
          <label for="role_name" class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Role <span class="text-red-500">*</span>
          </label>
          <select
            id="role_name"
            name="role_name"
            bind:value={selectedRole}
            required
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Select a role</option>
            {#each availableRoles as role}
              <option value={role.role}>
                {role.role} {role.requires_bank_id ? "(Bank)" : "(System)"}
              </option>
            {/each}
          </select>
        </div>

        {#if selectedRoleRequiresBank}
          <input type="hidden" name="bank_id" value={selectedBankId} />
          <div>
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Bank
            </label>
            {#if selectedBankId}
              <div class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {selectedBankId}
              </div>
            {:else}
              <div class="text-sm text-amber-600 dark:text-amber-400">
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
            class="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-800"
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
            onclick={() => { showAddScopeForm = false; selectedRole = ""; }}
            class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Role Name
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Bank ID
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Scope ID
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {#each scopes as scope}
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                {scope.role_name}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {scope.bank_id || "(System-level)"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
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
                    class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
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
    <div class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
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
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No scopes</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
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

<!-- Additional Actions -->
<div class="mt-6 flex flex-wrap gap-4">
  <a
    href="/consumers/{consumer.consumer_id}/rate-limits"
    class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
  >
    <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    Manage Rate Limits
  </a>
  <a
    href="/metrics?consumer_id={consumer.consumer_id}"
    class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
  >
    <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    View Metrics
  </a>
</div>
