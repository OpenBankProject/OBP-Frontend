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
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  // ?bank_id=, ?full_name= and ?bank_code= pre-fill the form, so another app can link here for a bank it needs.
  const prefill = (name: string) => page.url.searchParams.get(name)?.trim() ?? "";

  let bankId = $state(prefill("bank_id"));
  let fullName = $state(prefill("full_name"));
  let bankCode = $state(prefill("bank_code"));
  let logo = $state("");
  let website = $state("");
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  // Bank routings - dynamic list
  let routings = $state<Array<{ scheme: string; address: string }>>([]);

  function addRouting() {
    routings = [...routings, { scheme: "", address: "" }];
  }

  function removeRouting(index: number) {
    routings = routings.filter((_, i) => i !== index);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!bankId.trim()) {
      toast.error("Validation Error", "Bank ID is required");
      return;
    }

    if (!fullName.trim()) {
      toast.error("Validation Error", "Full Name is required");
      return;
    }

    isSubmitting = true;
    submitError = null;

    try {
      const requestBody: Record<string, any> = {
        bank_id: bankId.trim(),
        full_name: fullName.trim(),
        bank_code: bankCode.trim(),
        logo: logo.trim(),
        website: website.trim(),
        bank_routings: routings
          .filter((r) => r.scheme.trim() || r.address.trim())
          .map((r) => ({ scheme: r.scheme.trim(), address: r.address.trim() })),
      };

      const response = await trackedFetch("/proxy/obp/v6.0.0/banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const bodyText = await response.text();
      let body: any = null;
      try {
        body = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        throw new Error(
          `Unexpected non-JSON response from OBP (HTTP ${response.status}): ${bodyText}`,
        );
      }

      if (!response.ok) {
        if (!body || typeof body.message !== "string") {
          throw new Error(
            `Unexpected error format from OBP (HTTP ${response.status}): ${bodyText}`,
          );
        }
        const code = body.code != null ? String(body.code) : "";
        throw new Error(code ? `${code}: ${body.message}` : body.message);
      }

      if (!body || typeof body.bank_id !== "string" || !body.bank_id) {
        throw new Error(
          `Unexpected success response from OBP (HTTP ${response.status}): ${bodyText}`,
        );
      }

      toast.success("Bank Created", `Successfully created bank ${body.bank_id}`);

      setTimeout(() => {
        goto(`/banks/${body.bank_id}`);
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create bank";
      submitError = errorMessage;
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create Bank - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/banks"
        class="ui-link"
      >
        Banks
      </a>
      <span class="ui-muted">/</span>
      <span class="ui-muted">Create Bank</span>
    </div>
  </div>

  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold ui-text">
      Create Bank
    </h1>
    <p class="mt-1 ui-muted">
      Create a new bank in the Open Bank Project API. You will be automatically assigned the CanCreateEntitlementAtOneBank role.
    </p>
  </div>

  <!-- Form -->
  <div class="rounded-lg border ui-card ui-border">
    <form onsubmit={handleSubmit} class="p-6">
      <div class="space-y-6">
        <!-- Bank ID -->
        <div>
          <label
            for="bank-id"
            class="block text-sm font-medium ui-muted"
          >
            Bank ID <span class="ui-text-error">*</span>
          </label>
          <input
            id="bank-id"
            data-testid="bank-id-input"
            type="text"
            bind:value={bankId}
            placeholder="e.g., gh.29.uk"
            disabled={isSubmitting}
            required
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
          <p class="mt-1 text-xs ui-muted">
            A unique identifier for this bank
          </p>
        </div>

        <!-- Full Name -->
        <div>
          <label
            for="full-name"
            class="block text-sm font-medium ui-muted"
          >
            Full Name <span class="ui-text-error">*</span>
          </label>
          <input
            id="full-name"
            data-testid="full-name-input"
            type="text"
            bind:value={fullName}
            placeholder="e.g., Bank of Example"
            disabled={isSubmitting}
            required
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <!-- Bank Code -->
        <div>
          <label
            for="bank-code"
            class="block text-sm font-medium ui-muted"
          >
            Bank Code
          </label>
          <input
            id="bank-code"
            type="text"
            bind:value={bankCode}
            placeholder="e.g., CGHZ"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <!-- Logo URL -->
        <div>
          <label
            for="logo"
            class="block text-sm font-medium ui-muted"
          >
            Logo URL
          </label>
          <input
            id="logo"
            type="url"
            bind:value={logo}
            placeholder="https://example.com/logo.png"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <!-- Website -->
        <div>
          <label
            for="website"
            class="block text-sm font-medium ui-muted"
          >
            Website
          </label>
          <input
            id="website"
            type="url"
            bind:value={website}
            placeholder="https://www.example.com"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <!-- Bank Routings -->
        <div>
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium ui-muted">
              Bank Routings
            </label>
            <button
              type="button"
              onclick={addRouting}
              disabled={isSubmitting}
              class="inline-flex items-center text-sm disabled:opacity-50 ui-link"
            >
              <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Routing
            </button>
          </div>

          {#if routings.length > 0}
            <div class="mt-2 space-y-3">
              {#each routings as routing, index}
                <div class="flex items-start gap-3">
                  <div class="flex-1">
                    <input
                      type="text"
                      bind:value={routing.scheme}
                      placeholder="Scheme (e.g., OBP)"
                      disabled={isSubmitting}
                      class="block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
                    />
                  </div>
                  <div class="flex-1">
                    <input
                      type="text"
                      bind:value={routing.address}
                      placeholder="Address"
                      disabled={isSubmitting}
                      class="block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => removeRouting(index)}
                    disabled={isSubmitting}
                    class="mt-1 disabled:opacity-50 ui-text-error"
                    title="Remove routing"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="mt-2 text-xs ui-muted">
              No routings added. Click "Add Routing" to add bank routing information.
            </p>
          {/if}
        </div>
      </div>

      <!-- Inline error banner -->
      {#if submitError}
        <div class="mt-6 flex items-start gap-3 rounded-lg border p-4 ui-tone-error">
          <svg class="mt-0.5 h-5 w-5 flex-shrink-0 ui-text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium ui-text-error">Error</p>
            <p class="mt-1 text-sm ui-text-error">{submitError}</p>
          </div>
          <button
            type="button"
            onclick={() => (submitError = null)}
            class="ui-text-error"
            aria-label="Dismiss error"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}

      <!-- Actions -->
      <div class="mt-8 flex justify-end gap-3 border-t pt-6 ui-border">
        <a
          href="/banks"
          class="rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
        >
          Cancel
        </a>
        <button
          type="submit"
          data-testid="submit-create-bank"
          disabled={isSubmitting}
          class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
        >
          {isSubmitting ? "Creating..." : "Create Bank"}
        </button>
      </div>
    </form>
  </div>
</div>
