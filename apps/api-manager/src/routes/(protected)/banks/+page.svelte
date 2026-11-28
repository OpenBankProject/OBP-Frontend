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
      <h1 class="text-3xl font-bold ui-text">
        Banks
      </h1>
      <p class="mt-1 ui-muted">
        Browse all banks registered in the Open Bank Project API.
      </p>
    </div>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    <div
      class="rounded-lg border p-4 ui-card ui-border"
    >
      <div class="text-sm ui-muted">Total Banks</div>
      <div class="mt-1 text-2xl font-bold ui-text">
        {data.banks?.length || 0}
      </div>
    </div>
  </div>

  <!-- Error Message -->
  {#if data.error}
    <div
      class="mb-6 rounded-lg border p-4 ui-tone-error"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 ui-text-error"
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
          <h3 class="font-semibold ui-text-error">
            Error Loading Banks
          </h3>
          <p class="mt-1 text-sm ui-text-error">
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
          class="w-full rounded-lg border px-4 py-2 pl-10 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
        />
        <svg
          class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ui-muted"
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
            class="mb-4 h-16 w-16 ui-muted"
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
            class="mb-2 text-lg font-semibold ui-text"
          >
            No Banks Found
          </h3>
          <p class="ui-muted">
            There are currently no banks available.
          </p>
        {:else}
          <svg
            class="mb-4 h-16 w-16 ui-muted"
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
            class="mb-2 text-lg font-semibold ui-text"
          >
            No Matching Banks
          </h3>
          <p class="ui-muted">
            No banks match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y ui-border">
          <thead class="ui-card">
            <tr>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Logo
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Bank ID
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Full Name
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Bank Code
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Website
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Routings
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y ui-card ui-border"
          >
            {#each filteredBanks as bank}
              <tr class="ui-hover">
                <td class="whitespace-nowrap px-3 py-3 text-sm">
                  <button
                    type="button"
                    class="cursor-pointer rounded p-0.5 hover:ring-2"
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
                        class="hidden h-8 w-8 ui-muted"
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
                        class="h-8 w-8 ui-muted"
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
                    class="hover:underline ui-link"
                    onclick={() => currentBank.select(bank)}
                  >
                    {bank.bank_id || "Unknown"}
                  </a>
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm ui-muted"
                  title={bank.full_name || ""}
                >
                  {bank.full_name || "-"}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-sm ui-muted"
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
                      class="hover:underline ui-link"
                    >
                      {bank.website}
                    </a>
                  {:else}
                    <span class="ui-muted">-</span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm ui-muted"
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
        class="mt-4 flex items-center justify-between border-t px-4 py-3 ui-border"
      >
        <div class="text-sm ui-muted">
          Showing <span class="font-medium">{filteredBanks.length}</span>
          of
          <span class="font-medium">{data.banks?.length || 0}</span>
          banks
        </div>
      </div>
    {/if}
  </div>
</div>
