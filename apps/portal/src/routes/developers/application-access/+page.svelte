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
    import { getContext } from 'svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    const ctx: any = getContext('developerContext');
</script>

<svelte:head>
    <title>Application Access - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Application Access</h2>

    {#if data.entry}
        <section data-testid="application-access-glossary">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- OBP's own glossary, rendered with html:false -->
            {@html data.entry.html}
        </section>
    {:else}
        <p data-testid="application-access-glossary-missing">
            The glossary item <a href={data.glossaryHref}>{data.glossaryTitle}</a> could not be loaded.
        </p>
    {/if}

    <h3>Related</h3>

    <ul>
        <li><a href={data.glossaryHref}>{data.glossaryTitle}</a> in the glossary</li>
        <li><a href="/developers/consumer-creation">Consumer Creation</a></li>
        <li><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a></li>
        <li><a href="/developers/direct-login">Direct Login</a></li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv6.0.0-getCurrentConsumer" target="_blank" rel="noopener noreferrer">Get Current Consumer</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
