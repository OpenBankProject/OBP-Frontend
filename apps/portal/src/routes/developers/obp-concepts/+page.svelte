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

    const glossaryUrl = ctx.apiExplorerUrl ? `${ctx.apiExplorerUrl}/glossary` : '';
    const explorerUrl = ctx.apiExplorerUrl || '';
</script>

<svelte:head>
    <title>OBP Concepts - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Core Concepts</h2>

    <p>
        The Open Bank Project API is organised around a set of core entities and concepts.
        Understanding these will help you navigate the API effectively.
        {#if glossaryUrl}
            See also the full <a href={glossaryUrl} target="_blank" rel="noopener noreferrer">API Glossary</a>.
        {/if}
    </p>

    <h3>Banks</h3>

    <p>
        A <strong>Bank</strong> is the top-level entity in OBP. Most resources (accounts, customers,
        transactions) belong to a bank. Banks are identified by a <code>bank_id</code> string.
    </p>

    <CodeBlock
        code={`GET /obp/v6.0.0/banks
GET /obp/v6.0.0/banks/BANK_ID`}
    />

    <h3>Accounts</h3>

    <p>
        An <strong>Account</strong> represents a bank account. Accounts belong to a bank and are
        identified by a combination of <code>bank_id</code> and <code>account_id</code>. Accounts
        have views which control what data is visible.
    </p>

    <CodeBlock
        code={`GET /obp/v6.0.0/my/banks/BANK_ID/accounts
GET /obp/v6.0.0/my/banks/BANK_ID/accounts/ACCOUNT_ID/account`}
    />

    <h3>Views</h3>

    <p>
        <strong>Views</strong> control access to account data. Each account can have multiple views
        (e.g. <code>owner</code>, <code>public</code>, <code>accountant</code>). Views determine
        which fields of a transaction or account are visible to the user. The <code>owner</code> view
        provides full access to the account holder.
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=View" target="_blank" rel="noopener noreferrer">View endpoints</a> in the API Explorer.
        {/if}
    </p>

    <h3>Transactions</h3>

    <p>
        A <strong>Transaction</strong> records a movement of money on an account. Transactions
        include details like the amount, currency, description, and counterparty. Access to
        transaction data is controlled by views.
    </p>

    <CodeBlock
        code="GET /obp/v6.0.0/my/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transactions"
    />

    <h3>Transaction Requests</h3>

    <p>
        A <strong>Transaction Request</strong> is how you initiate payments in OBP. It goes through
        a lifecycle of validation, optional challenge, and completion before a Transaction is
        created. See the <a href="/developers/transaction-requests">Transaction Requests</a> page for details.
    </p>

    <h3>Customers</h3>

    <p>
        A <strong>Customer</strong> represents a bank customer (a person or organisation that has a
        relationship with the bank). A User can be linked to one or more Customers at different banks.
        Customers hold KYC and CDD information.
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=Customer" target="_blank" rel="noopener noreferrer">Customer endpoints</a> in the API Explorer.
        {/if}
    </p>

    <h3>Users</h3>

    <p>
        A <strong>User</strong> is someone who authenticates with the API. Users can have
        <strong>Entitlements</strong> (roles) that grant them permissions to perform actions such as
        creating accounts or managing customers. Users are linked to Customers to access account data.
    </p>

    <h3>Consumers (Applications)</h3>

    <p>
        A <strong>Consumer</strong> represents a registered application. When you register your app,
        you receive a consumer key and secret. These are used during authentication to identify your
        application to the API. See <a href="/developers/consumer-creation">Consumer Creation</a>.
    </p>

    <h3>Entitlements (Roles)</h3>

    <p>
        <strong>Entitlements</strong> grant users permission to call specific API endpoints. Some
        entitlements are bank-specific (e.g. <code>CanCreateAccount</code> at a particular bank)
        while others are system-wide (e.g. <code>CanGetAnyUser</code>). You can view your
        entitlements in <a href="/user/entitlements">My Entitlements</a>.
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=Role" target="_blank" rel="noopener noreferrer">Role endpoints</a> in the API Explorer.
        {/if}
    </p>

    <h3>Consents</h3>

    <p>
        <strong>Consents</strong> allow third-party applications to act on behalf of a user with a
        limited set of views for a limited time. This supports Open Banking and PSD2 flows where
        account holders grant access to their data. See the <a href="/developers/consents">Consents</a> page for details,
        including Variable Recurring Payments (VRP).
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=Consent" target="_blank" rel="noopener noreferrer">Consent endpoints</a> in the API Explorer.
        {/if}
    </p>

    <h3>API Collections</h3>

    <p>
        <strong>API Collections</strong> let you organise and group API endpoints into named
        collections for easy reference and sharing. You can manage your collections in
        <a href="/user/api-collections">My API Collections</a>.
    </p>

    <h3>Dynamic Entities</h3>

    <p>
        <strong>Dynamic Entities</strong> allow banks and users to define custom data structures
        at runtime without code changes. These extend the API with bank-specific or user-specific
        data models (e.g. custom KYC fields, product attributes).
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=Dynamic-Entity-Manage" target="_blank" rel="noopener noreferrer">Dynamic Entity endpoints</a> in the API Explorer.
        {/if}
    </p>

    <h3>Webhooks</h3>

    <p>
        <strong>Webhooks</strong> allow your application to receive HTTP callbacks when events occur
        in the banking system (e.g. when a new transaction is created). This enables event-driven
        architectures.
        {#if explorerUrl}
            See <a href="{explorerUrl}/resource-docs?tags=Webhook" target="_blank" rel="noopener noreferrer">Webhook endpoints</a> in the API Explorer.
        {/if}
    </p>
</div>
