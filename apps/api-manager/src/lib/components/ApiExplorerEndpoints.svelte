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
  import { ExternalLink } from "@lucide/svelte";

  /**
   * The OBP endpoints a page is built on, each linking to its resource doc in the API Explorer —
   * so an operator can see the request, the roles and the example payloads behind what they are
   * looking at, and call it themselves.
   */
  interface ExplorerEndpoint {
    /** e.g. "OBPv7.0.0-getApiGlossary"; the Explorer URL is built from it on the server. */
    operation_id: string;
    verb: string;
    path: string;
    url: string;
  }

  let {
    endpoints,
    label = "Built on",
    testid = "api-explorer-endpoints",
  }: { endpoints: ExplorerEndpoint[]; label?: string; testid?: string } = $props();
</script>

{#if endpoints.length > 0}
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400" data-testid={testid}>
    <span class="font-medium uppercase tracking-wide">{label}</span>
    {#each endpoints as e (e.operation_id)}
      <a
        href={e.url}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 font-mono text-blue-700 hover:bg-blue-50 dark:border-gray-700 dark:text-blue-300 dark:hover:bg-gray-700"
        data-testid="endpoint-{e.operation_id}"
      >
        <span class="font-semibold">{e.verb}</span>
        <span>{e.path}</span>
        <ExternalLink size={11} />
      </a>
    {/each}
  </div>
{/if}
