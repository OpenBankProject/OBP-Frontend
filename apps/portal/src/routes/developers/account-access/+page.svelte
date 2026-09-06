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
    <title>Account Access - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Account Access and Views</h2>

    <p>
        In OBP, access to account data is controlled through <strong>Views</strong>. Views determine
        which fields of an account or transaction are visible to which users. This mechanism enables
        fine-grained access control without duplicating data.
    </p>

    <h3>What is a View?</h3>

    <p>
        A View is a named access level on an account. Each account can have multiple Views, and each
        View defines which data fields are visible. Common Views include:
    </p>

    <table>
        <thead>
            <tr>
                <th>View</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>owner</code></td>
                <td>Full access &mdash; all fields visible. Only the account holder has this by default.</td>
            </tr>
            <tr>
                <td><code>accountant</code></td>
                <td>Access to financial data like balances and transactions, but may hide personal details.</td>
            </tr>
            <tr>
                <td><code>auditor</code></td>
                <td>Read-only access for audit purposes.</td>
            </tr>
            <tr>
                <td><code>public</code></td>
                <td>Fields visible to anyone without authentication (if enabled).</td>
            </tr>
        </tbody>
    </table>

    <p>
        Banks and account holders can also create <strong>custom Views</strong> to tailor access for
        specific use cases.
    </p>

    <h3>How Access Works</h3>

    <p>
        When you call an account endpoint, you specify a <code>VIEW_ID</code> in the URL. The API
        returns only the fields permitted by that View for your user:
    </p>

    <CodeBlock code="GET /obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/account" />

    <p>
        If you don't have access to the requested View, the API returns an error.
    </p>

    <h3>Listing Available Views</h3>

    <p>
        To see which Views you have access to on an account{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.0.0-getViewsForBankAccount" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v5.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/views" />

    <h3>Granting Access</h3>

    <p>
        Account owners can grant other users access to a View on their account{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.1.0-grantUserAccessToViewById" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v5.1.0/banks/BANK_ID/accounts/ACCOUNT_ID/views/VIEW_ID/account-access/grant

{
  "user_id": "USER_ID_TO_GRANT"
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Revoking Access</h3>

    <p>
        To revoke a user's access to a View{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.1.0-revokeUserAccessToViewById" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v5.1.0/banks/BANK_ID/accounts/ACCOUNT_ID/views/VIEW_ID/account-access/revoke

{
  "user_id": "USER_ID_TO_REVOKE"
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Creating Custom Views</h3>

    <p>
        You can create custom Views to define exactly which fields are visible. This is useful for
        sharing limited account access with third parties, accountants, or internal teams.
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v5.1.0/banks/BANK_ID/accounts/ACCOUNT_ID/views/owner/target-views

{
  "name": "my-custom-view",
  "description": "Limited view for my accountant",
  "metadata_view": "owner",
  "is_public": false,
  "which_alias_to_use": "none",
  "hide_metadata_if_alias_used": false,
  "allowed_actions": [
    "can_see_transaction_this_bank_account",
    "can_see_transaction_amount",
    "can_see_transaction_currency",
    "can_see_bank_account_balance"
  ]
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Views and Consents</h3>

    <p>
        When creating a <a href="/developers/consents">Consent</a> for a third-party app, you specify
        which Views the app can access. This means the account holder controls exactly what data the
        third party can see, combining the consent mechanism with View-based access control.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/access-to-accounts">Access to Accounts</a> &mdash; list and view account data</li>
        <li><a href="/developers/consents">Consents</a> &mdash; grant third-party access via consents</li>
        <li><a href="/developers/obp-concepts">OBP Concepts</a> &mdash; broader overview of the data model</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Account-Access" target="_blank" rel="noopener noreferrer">Account Access endpoints</a> in the API Explorer</li>
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=View-Custom" target="_blank" rel="noopener noreferrer">View endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
