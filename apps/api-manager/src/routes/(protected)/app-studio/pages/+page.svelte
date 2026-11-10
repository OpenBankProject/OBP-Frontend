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
  import { onMount } from "svelte";
  import { ExternalLink, FileText, Pencil, Plus } from "@lucide/svelte";

  let { data } = $props();

  interface SavedPage {
    id: string;
    slug: string;
    title: string;
    kind: "page" | "app";
    status: "draft" | "published";
    author: string;
    updated_at: string;
    sites: string[];
    lang: string;
  }

  const SITE_LABELS: Record<string, string> = { portal: "Portal", cohort: "Cohort" };

  let pages = $state<SavedPage[]>([]);
  let loading = $state(true);
  let loadError = $state("");
  let filter = $state("");

  const shown = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => `${p.title} ${p.slug} ${p.lang} ${p.status} ${p.author} ${p.sites.join(" ")}`.toLowerCase().includes(q));
  });

  onMount(async () => {
    try {
      const response = await fetch("/backend/app-studio/pages", { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
      pages = body.pages ?? [];
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Pages - App Studio</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        <FileText class="h-7 w-7" />
        Pages
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        The pages and apps saved in App Studio, newest change first. A published page shows at <code>/pages/SLUG</code> on each site ticked for it.
      </p>
    </div>
    <a href="/app-studio?new=1" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-testid="pages-new">
      <Plus class="h-4 w-4" /> New page
    </a>
  </div>

  {#if loading}
    <p class="text-gray-600 dark:text-gray-400">Loading the pages…</p>
  {:else if loadError}
    <div class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="pages-error">
      The pages could not be listed: {loadError}. <a href="/app-studio/help" class="underline">App Studio Help</a> shows what this instance needs.
    </div>
  {:else if pages.length === 0}
    <p class="text-gray-600 dark:text-gray-400" data-testid="pages-empty">No pages saved yet. <a href="/app-studio" class="underline">Open App Studio</a> to write one.</p>
  {:else}
    <input
      type="search"
      bind:value={filter}
      placeholder="Filter by title, slug, language, site, status or author"
      class="mb-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
      data-testid="pages-filter"
    />
    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="w-full text-left text-sm" data-testid="pages-table">
        <thead class="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <tr>
            <th class="px-3 py-2">Title</th>
            <th class="px-3 py-2">Slug</th>
            <th class="px-3 py-2">Language</th>
            <th class="px-3 py-2">Kind</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2">Shown on</th>
            <th class="px-3 py-2">Last change</th>
            <th class="px-3 py-2"><span class="sr-only">Edit</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          {#each shown as p (p.id)}
            <tr class="text-gray-800 dark:text-gray-200" data-testid="pages-row">
              <td class="px-3 py-2 font-medium"><a href="/app-studio?page={encodeURIComponent(p.id)}" class="hover:underline">{p.title}</a></td>
              <td class="px-3 py-2"><code>{p.slug}</code></td>
              <td class="px-3 py-2">{p.lang || "any"}</td>
              <td class="px-3 py-2">{p.kind === "app" ? "App" : "Page"}</td>
              <td class="px-3 py-2">
                <span class="rounded px-1.5 py-0.5 text-xs {p.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}">{p.status === "published" ? "Published" : "Draft"}</span>
              </td>
              <td class="px-3 py-2">
                {#if p.sites.length === 0}
                  <span class="text-gray-500">No site</span>
                {/if}
                {#each p.sites as site}
                  {#if p.status === "published" && data.siteUrls[site]}
                    <a href="{data.siteUrls[site]}/pages/{p.slug}" target="_blank" rel="noopener noreferrer" class="mr-2 inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400">{SITE_LABELS[site] ?? site}<ExternalLink class="h-3 w-3" /></a>
                  {:else}
                    <span class="mr-2">{SITE_LABELS[site] ?? site}</span>
                  {/if}
                {/each}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">{p.updated_at.replace("T", " ").slice(0, 16)}{p.author ? ` by ${p.author}` : ""}</td>
              <td class="px-3 py-2 text-right">
                <a href="/app-studio?page={encodeURIComponent(p.id)}" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400" data-testid="pages-edit"><Pencil class="h-3.5 w-3.5" /> Edit</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if shown.length === 0}<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">No page matches “{filter}”.</p>{/if}
  {/if}
</div>
