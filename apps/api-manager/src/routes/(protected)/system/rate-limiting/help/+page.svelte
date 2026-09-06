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
  import { CircleHelp, ExternalLink } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";

  let { data } = $props();

  const explorerRateLimitsTagUrl = $derived(`${data.explorerUrl}/?tags=Rate-Limits`);
  const rateLimitersDocUrl = $derived(
    `${data.explorerUrl}/resource-docs/OBPv7.0.0?operationid=OBPv7.0.0-getRateLimiterConfig`,
  );
</script>

<svelte:head>
  <title>Rate Limiting Help - API Manager II</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <nav class="mb-6 text-sm text-gray-600 dark:text-gray-400" aria-label="Breadcrumb">
    <a href="/system/rate-limiting" class="hover:underline">Rate Limiting</a>
    <span class="mx-2" aria-hidden="true">&gt;</span>
    <span class="text-gray-900 dark:text-gray-100">Help</span>
  </nav>

  <div class="mb-6 flex items-center gap-3">
    <CircleHelp size={32} class="text-blue-600 dark:text-blue-400" />
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Rate Limiting Help</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Which limiter a 429 came from, and what each one counts.</p>
    </div>
  </div>

  {#if data.warnings.length > 0}
    <div
      class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      data-testid="rate-limiting-help-warnings"
    >
      <ul class="list-disc pl-5">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
    </div>
  {/if}

  <section
    class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    data-testid="rate-limiting-help-summary"
  >
    <h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">In short</h2>
    <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
      <li>
        <strong>Self-service</strong> is checked first, before login, by client IP address, on the endpoints anyone
        can call: sign-up, password reset, consent requests, consumer registration, lookups, channel creation.
        Trip: <code class="font-mono">OBP-10060</code>.
      </li>
      <li>
        <strong>Authentication</strong> is checked while a login is verified, by IP address and by account, against
        brute force and lockout attacks. Trip: <code class="font-mono">OBP-10061</code>.
      </li>
      <li>
        <strong>Consumer quota</strong> is checked after login, by Consumer, on every endpoint. It is the commercial
        limit set per Consumer or by an API Product Subscription. Trip: <code class="font-mono">OBP-10018</code>.
      </li>
      <li>
        <strong>Shadow mode</strong> counts and warns in the <code class="font-mono">X-Rate-Limit-Warning</code>
        header but allows the request. <strong>Enforce</strong> answers 429 with a
        <code class="font-mono">Retry-After</code> header. Every limiter counts in Redis and fails open.
      </li>
    </ul>
  </section>

  <section
    class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    data-testid="rate-limiting-help-glossary"
  >
    <h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">From the OBP glossary</h2>
    <GlossaryEntry
      title={data.glossary.title}
      html={data.glossary.html}
      explorerUrl={data.glossary.explorerUrl}
      testid="rate-limiting-glossary-entry"
    />
  </section>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">Further reading</h2>
    <ul class="space-y-2 text-sm">
      <li>
        <a href={rateLimitersDocUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
          Get Rate Limiters, the endpoint behind the Rate Limiting page <ExternalLink size={14} />
        </a>
      </li>
      <li>
        <a href={explorerRateLimitsTagUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
          All Rate-Limits endpoints in the API Explorer, including per-Consumer limits <ExternalLink size={14} />
        </a>
      </li>
    </ul>
  </section>
</div>
