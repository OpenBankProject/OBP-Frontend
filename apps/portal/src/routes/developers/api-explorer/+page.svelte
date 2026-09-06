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
    import CodeBlock from '$lib/components/CodeBlock.svelte';

    const ctx: any = getContext('developerContext');
    const explorerUrl = ctx.apiExplorerUrl || '';
</script>

<svelte:head>
    <title>API Explorer - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>API Explorer</h2>

    <p>
        The OBP API Explorer is an interactive tool for browsing, searching, and testing all
        available OBP API endpoints. It is the best way to understand what the API offers and to
        try out calls before writing code.
    </p>

    {#if explorerUrl}
        <p>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" class="font-semibold">Open the API Explorer &rarr;</a>
        </p>
    {/if}

    <h3>What You Can Do</h3>

    <ul>
        <li><strong>Browse endpoints by tag</strong> &mdash; endpoints are grouped into categories like Account, Transaction, Customer, Consent, etc.</li>
        <li><strong>Search</strong> &mdash; find endpoints by name, path, or description</li>
        <li><strong>View schemas</strong> &mdash; see the full request body, response body, and URL parameters for every endpoint</li>
        <li><strong>Try it out</strong> &mdash; make live API calls directly from the browser with your authentication token</li>
        <li><strong>Read the glossary</strong> &mdash; look up OBP terminology, error codes, and concepts</li>
    </ul>

    <h3>Navigating the Explorer</h3>

    <h4>By Tag</h4>

    <p>
        Endpoints are organised by tags. Some commonly used tags:
    </p>

    <table>
        <thead>
            <tr>
                <th>Tag</th>
                <th>What it covers</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Account</td>
                <td>Create, read, and manage bank accounts</td>
            </tr>
            <tr>
                <td>Transaction</td>
                <td>View transaction history and metadata</td>
            </tr>
            <tr>
                <td>Transaction-Request</td>
                <td>Initiate payments and handle challenges</td>
            </tr>
            <tr>
                <td>Customer</td>
                <td>Customer records, KYC, and CDD</td>
            </tr>
            <tr>
                <td>Consent</td>
                <td>Account access consents and VRP consents</td>
            </tr>
            <tr>
                <td>Counterparty</td>
                <td>Manage payment counterparties</td>
            </tr>
            <tr>
                <td>View (System)</td>
                <td>Manage account views and permissions</td>
            </tr>
            <tr>
                <td>Role</td>
                <td>Entitlements and role management</td>
            </tr>
            <tr>
                <td>Dynamic-Entity-Manage</td>
                <td>Define custom data structures</td>
            </tr>
            <tr>
                <td>Webhook</td>
                <td>Event-driven callbacks</td>
            </tr>
        </tbody>
    </table>

    {#if explorerUrl}
        <p>
            Browse tags directly: <a href="{explorerUrl}/resource-docs" target="_blank" rel="noopener noreferrer">All tags</a>
        </p>
    {/if}

    <h4>By Operation ID</h4>

    <p>
        Every endpoint has a unique <code>operation_id</code> (e.g. <code>OBPv4.0.0-getBanks</code>).
        You can link directly to any endpoint in the Explorer:
    </p>

    {#if explorerUrl}
        <CodeBlock code={`${explorerUrl}/resource-docs/v6.0.0?operationid=OBPv4.0.0-getBanks`} />
    {:else}
        <CodeBlock code="YOUR_API_EXPLORER/resource-docs/v6.0.0?operationid=OBPv4.0.0-getBanks" />
    {/if}

    <h3>Glossary</h3>

    <p>
        The API Explorer includes a comprehensive glossary of OBP terms, error codes, and concepts.
        This is useful when you encounter an unfamiliar term or error code in an API response.
    </p>

    {#if explorerUrl}
        <p>
            <a href="{explorerUrl}/glossary" target="_blank" rel="noopener noreferrer">Open the Glossary &rarr;</a>
        </p>
    {/if}

    <h3>Authentication in the Explorer</h3>

    <p>
        To make authenticated calls from the Explorer, you need to provide a token. You can obtain
        one via <a href="/developers/direct-login">Direct Login</a> or
        <a href="/developers/oauth2-oidc">OAuth2</a> and enter it in the Explorer's authentication
        section.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/getting-started">Getting Started</a> &mdash; quick start guide</li>
        <li><a href="/developers/opey">Opey</a> &mdash; ask the AI assistant about any endpoint</li>
        <li><a href="/developers/agents-and-mcp">Agents and MCP</a> &mdash; programmatic endpoint discovery</li>
    </ul>
</div>
