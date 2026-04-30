<script lang="ts">
  import { goto } from "$app/navigation";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let bankId = $state("");
  let fullName = $state("");
  let bankCode = $state("");
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
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Banks
      </a>
      <span class="text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-400">Create Bank</span>
    </div>
  </div>

  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Create Bank
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Create a new bank in the Open Bank Project API. You will be automatically assigned the CanCreateEntitlementAtOneBank role.
    </p>
  </div>

  <!-- Form -->
  <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <form onsubmit={handleSubmit} class="p-6">
      <div class="space-y-6">
        <!-- Bank ID -->
        <div>
          <label
            for="bank-id"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Bank ID <span class="text-red-600">*</span>
          </label>
          <input
            id="bank-id"
            data-testid="bank-id-input"
            type="text"
            bind:value={bankId}
            placeholder="e.g., gh.29.uk"
            disabled={isSubmitting}
            required
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A unique identifier for this bank
          </p>
        </div>

        <!-- Full Name -->
        <div>
          <label
            for="full-name"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Full Name <span class="text-red-600">*</span>
          </label>
          <input
            id="full-name"
            data-testid="full-name-input"
            type="text"
            bind:value={fullName}
            placeholder="e.g., Bank of Example"
            disabled={isSubmitting}
            required
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
          />
        </div>

        <!-- Bank Code -->
        <div>
          <label
            for="bank-code"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Bank Code
          </label>
          <input
            id="bank-code"
            type="text"
            bind:value={bankCode}
            placeholder="e.g., CGHZ"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
          />
        </div>

        <!-- Logo URL -->
        <div>
          <label
            for="logo"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Logo URL
          </label>
          <input
            id="logo"
            type="url"
            bind:value={logo}
            placeholder="https://example.com/logo.png"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
          />
        </div>

        <!-- Website -->
        <div>
          <label
            for="website"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Website
          </label>
          <input
            id="website"
            type="url"
            bind:value={website}
            placeholder="https://www.example.com"
            disabled={isSubmitting}
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
          />
        </div>

        <!-- Bank Routings -->
        <div>
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bank Routings
            </label>
            <button
              type="button"
              onclick={addRouting}
              disabled={isSubmitting}
              class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
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
                      class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
                    />
                  </div>
                  <div class="flex-1">
                    <input
                      type="text"
                      bind:value={routing.address}
                      placeholder="Address"
                      disabled={isSubmitting}
                      class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => removeRouting(index)}
                    disabled={isSubmitting}
                    class="mt-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
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
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              No routings added. Click "Add Routing" to add bank routing information.
            </p>
          {/if}
        </div>
      </div>

      <!-- Inline error banner -->
      {#if submitError}
        <div class="mt-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
          <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
            <p class="mt-1 text-sm text-red-700 dark:text-red-400">{submitError}</p>
          </div>
          <button
            type="button"
            onclick={() => (submitError = null)}
            class="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
            aria-label="Dismiss error"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}

      <!-- Actions -->
      <div class="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
        <a
          href="/banks"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </a>
        <button
          type="submit"
          data-testid="submit-create-bank"
          disabled={isSubmitting}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isSubmitting ? "Creating..." : "Create Bank"}
        </button>
      </div>
    </form>
  </div>
</div>
