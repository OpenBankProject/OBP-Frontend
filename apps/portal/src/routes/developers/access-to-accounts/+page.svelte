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
</script>

<svelte:head>
    <title>Access to Accounts - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Access to Accounts</h2>

    <p>
        This page explains how to list, view, and work with bank accounts via the OBP API.
    </p>

    <h3>List Your Accounts</h3>

    <p>
        To get all accounts you have access to across all banks{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv3.0.0-corePrivateAccountsAllBanks" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v3.0.0/my/accounts" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        To list accounts at a specific bank{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv6.0.0-getAccountsAtBank" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/accounts" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Get Account Details</h3>

    <p>
        To get the full details of a specific account, you need the <code>bank_id</code>,
        <code>account_id</code>, and a <code>view_id</code> you have access to{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv6.0.0-getPrivateAccountByIdFull" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/owner/account" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        The response includes the account balance, type, label, IBAN, and other routing information.
    </p>

    <h3>Get Account Balances</h3>

    <p>
        To get balances for a specific account{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.1.0-getBankAccountBalances" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v5.1.0/banks/BANK_ID/accounts/ACCOUNT_ID/views/VIEW_ID/balances" />

    <p>
        Or get balances for all accounts at a bank{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.1.0-getBankAccountsBalances" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v5.1.0/banks/BANK_ID/balances" />

    <h3>Get Transactions</h3>

    <p>
        To list transactions on an account{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv6.0.0-getTransactionsForBankAccount" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/owner/transactions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        Transactions include the amount, currency, description, date, counterparty details, and
        metadata. The View you use determines which fields are returned.
    </p>

    <h3>Public Accounts</h3>

    <p>
        Some accounts may be marked as public. These can be accessed without authentication{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv2.0.0-publicAccountsAtOneBank" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v2.0.0/banks/BANK_ID/accounts/public" />

    <h3>Counterparties</h3>

    <p>
        Counterparties are the other parties in a transaction (the payee or payer). You can list
        and manage counterparties on an account{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-getExplicitCounterpartiesForAccount" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v4.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/counterparties" />

    <p>
        You can also create counterparties, which is needed before making
        <a href="/developers/transaction-requests">COUNTERPARTY transaction requests</a>{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-createCounterparty" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}.
    </p>

    <h3>Check Funds Available</h3>

    <p>
        You can check whether sufficient funds are available on an account without seeing the
        balance itself. This supports the PSD2 Confirmation of Funds Service{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv3.1.0-checkFundsAvailable" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v3.1.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/funds-available" />

    <h3>Accessing Accounts as a Third Party</h3>

    <p>
        If you are building a third-party application that needs to access other users' accounts,
        you will need:
    </p>

    <ol>
        <li>The user to grant a <a href="/developers/consents">Consent</a> specifying which accounts and Views your app can access</li>
        <li>An <a href="/developers/oauth2-oidc">OAuth2</a> flow for the user to authorise your app</li>
        <li>The consent JWT, which you include in your API requests</li>
    </ol>

    <p>
        See <a href="/developers/account-access">Account Access</a> for details on how Views control
        what data is visible through each access level.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/account-access">Account Access</a> &mdash; how Views and access control work</li>
        <li><a href="/developers/transaction-requests">Transaction Requests</a> &mdash; make payments from an account</li>
        <li><a href="/developers/consents">Consents</a> &mdash; grant third-party access to accounts</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Account" target="_blank" rel="noopener noreferrer">All Account endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
