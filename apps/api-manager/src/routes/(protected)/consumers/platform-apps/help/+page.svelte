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
  import { CircleHelp } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";
  import HelpReferences from "$lib/components/HelpReferences.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>Platform Apps Help - API Manager II</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <nav class="mb-6 text-sm text-gray-600 dark:text-gray-400" aria-label="Breadcrumb">
    <a href="/consumers/platform-apps" class="hover:underline">Platform Apps</a>
    <span class="mx-2" aria-hidden="true">&gt;</span>
    <span class="text-gray-900 dark:text-gray-100">Help</span>
  </nav>

  <h1 class="mb-6 flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
    <CircleHelp size={32} class="text-blue-600 dark:text-blue-400" /> Platform Apps Help
  </h1>

  <section
    class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    data-testid="platform-apps-help-glossary"
  >
    {#if data.glossary.html}
      <GlossaryEntry html={data.glossary.html} testid="platform-apps-glossary-entry" />
    {:else}
      <p class="text-sm text-amber-700 dark:text-amber-400" data-testid="platform-apps-help-warning">{data.glossary.warning}</p>
    {/if}
  </section>

  <div class="mt-6">
    <HelpReferences sources={[{ title: data.title, explorerUrl: data.glossary.url }]} />
  </div>
</div>
