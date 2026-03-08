<script lang="ts">
  import type { PageData } from "./$types";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  let { data }: { data: PageData } = $props();

  let searchQuery = $state("");

  const filteredBanks = $derived(
    (data.banks || []).filter((bank: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const bankId = (bank.bank_id || "").toLowerCase();
      const fullName = (bank.full_name || "").toLowerCase();
      const bankCode = (bank.bank_code || "").toLowerCase();
      const website = (bank.website || "").toLowerCase();

      return (
        bankId.includes(query) ||
        fullName.includes(query) ||
        bankCode.includes(query) ||
        website.includes(query)
      );
    }),
  );
</script>

<svelte:head>
  <title>Banks - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Banks
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Browse all banks registered in the Open Bank Project API.
      </p>
    </div>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">Total Banks</div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {data.banks?.length || 0}
      </div>
    </div>
  </div>

  <!-- Error Message -->
  {#if data.error}
    <div
      class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 text-red-600 dark:text-red-400"
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
          <h3 class="font-semibold text-red-800 dark:text-red-300">
            Error Loading Banks
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">
            {data.error}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search -->
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
    <div class="flex-1">
      <div class="relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by bank ID, name, code, or website..."
          class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pl-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
        <svg
          class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- Banks List -->
  <div>
    {#if filteredBanks.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if !data.banks || data.banks.length === 0}
          <svg
            class="mb-4 h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3
            class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            No Banks Found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            There are currently no banks available.
          </p>
        {:else}
          <svg
            class="mb-4 h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3
            class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            No Matching Banks
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            No banks match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Logo
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Bank ID
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Full Name
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Bank Code
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Website
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Routings
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800"
          >
            {#each filteredBanks as bank}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="whitespace-nowrap px-3 py-3 text-sm">
                  <button
                    type="button"
                    class="cursor-pointer rounded p-0.5 hover:ring-2 hover:ring-blue-400"
                    title="Set {bank.full_name || bank.bank_id} as current bank"
                    onclick={() => currentBank.select(bank)}
                  >
                    {#if bank.logo && !bank.logo.includes('example.com')}
                      <img
                        src={bank.logo}
                        alt="{bank.full_name} logo"
                        class="h-8 w-8 rounded object-contain"
                        onerror={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <svg
                        class="hidden h-8 w-8 text-gray-300 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    {:else}
                      <svg
                        class="h-8 w-8 text-gray-300 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    {/if}
                  </button>
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-sm font-medium">
                  <a
                    href="/banks/{bank.bank_id}"
                    class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    onclick={() => currentBank.select(bank)}
                  >
                    {bank.bank_id || "Unknown"}
                  </a>
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm text-gray-700 dark:text-gray-300"
                  title={bank.full_name || ""}
                >
                  {bank.full_name || "-"}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  {bank.bank_code || "-"}
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm"
                >
                  {#if bank.website}
                    <a
                      href={bank.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {bank.website}
                    </a>
                  {:else}
                    <span class="text-gray-400">-</span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                >
                  {bank.bank_routings?.length || 0}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Results Summary -->
      <div
        class="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
      >
        <div class="text-sm text-gray-700 dark:text-gray-300">
          Showing <span class="font-medium">{filteredBanks.length}</span>
          of
          <span class="font-medium">{data.banks?.length || 0}</span>
          banks
        </div>
      </div>
    {/if}
  </div>
</div>
