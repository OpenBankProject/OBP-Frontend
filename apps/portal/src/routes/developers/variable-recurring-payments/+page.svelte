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
    <title>Variable Recurring Payments - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Variable Recurring Payments (VRP)</h2>

    <p>
        VRP consents allow a third-party payment service provider (PISP) to make multiple payments
        from a user's account within agreed parameters, without requiring individual authorisation
        for each payment.
    </p>

    <h3>Use Cases</h3>

    <ul>
        <li><strong>Sweeping</strong> &mdash; automatically moving funds between a user's own accounts (e.g. from a current account to a savings account)</li>
        <li><strong>Subscription payments</strong> &mdash; recurring charges within agreed limits, replacing card-on-file</li>
        <li><strong>Smart savings</strong> &mdash; automated transfers based on rules (e.g. round-up savings)</li>
        <li><strong>Bill payments</strong> &mdash; variable-amount payments to the same payee (e.g. utility bills)</li>
    </ul>

    <h3>How VRP Differs from Regular Payments</h3>

    <p>
        With a regular <a href="/developers/transaction-requests">Transaction Request</a>, the user
        must authorise each individual payment. With VRP, the user authorises a
        <strong>consent</strong> that defines the rules (maximum amounts, frequency, payee) and the
        PISP can then initiate multiple payments within those rules without further user interaction.
    </p>

    <h3>Creating a VRP Consent</h3>

    <p>
        A VRP consent request includes limits that define the maximum amount and frequency of
        payments{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.1.0-createVRPConsentRequest" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v5.1.0/consumer/vrp-consent-requests

{
  "account_routing": {
    "scheme": "AccountId",
    "address": "ACCOUNT_ID"
  },
  "from_account": {
    "bank_routing": {
      "scheme": "BankId",
      "address": "BANK_ID"
    },
    "account_routing": {
      "scheme": "AccountId",
      "address": "SOURCE_ACCOUNT_ID"
    }
  },
  "to_account": {
    "bank_routing": {
      "scheme": "BankId",
      "address": "TARGET_BANK_ID"
    },
    "account_routing": {
      "scheme": "AccountId",
      "address": "TARGET_ACCOUNT_ID"
    }
  },
  "max_single_amount": 100,
  "max_monthly_amount": 500,
  "max_number_of_monthly_transactions": 10,
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_to": "2026-12-31T23:59:59Z"
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Consent Parameters</h3>

    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>max_single_amount</code></td>
                <td>Maximum amount for any single payment</td>
            </tr>
            <tr>
                <td><code>max_monthly_amount</code></td>
                <td>Maximum total amount that can be paid in a calendar month</td>
            </tr>
            <tr>
                <td><code>max_number_of_monthly_transactions</code></td>
                <td>Maximum number of payments per month</td>
            </tr>
            <tr>
                <td><code>valid_from</code> / <code>valid_to</code></td>
                <td>Time window during which the consent is active</td>
            </tr>
            <tr>
                <td><code>from_account</code></td>
                <td>The user's account to debit</td>
            </tr>
            <tr>
                <td><code>to_account</code></td>
                <td>The payee's account to credit</td>
            </tr>
        </tbody>
    </table>

    <h3>VRP Consent Lifecycle</h3>

    <ol>
        <li>The PISP creates a VRP consent request with the payment parameters</li>
        <li>The user reviews the limits (max single amount, monthly amount, frequency) and authorises{#if ctx.apiExplorerUrl}
            (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv5.0.0-createConsentByConsentRequestIdEmail" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}</li>
        <li>Once active, the PISP can initiate payments within the agreed limits without further user interaction</li>
        <li>Each payment is validated against the consent limits before execution</li>
        <li>The user can revoke the consent at any time from <a href="/user/consents">My Consents</a></li>
    </ol>

    <h3>Making Payments Under a VRP Consent</h3>

    <p>
        Once a VRP consent is active, the PISP initiates payments by including the consent JWT in
        the request header{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-createTransactionRequestAccount" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transaction-request-types/ACCOUNT/transaction-requests

Consent-JWT: YOUR_VRP_CONSENT_JWT

{
  "to": {
    "bank_id": "TARGET_BANK_ID",
    "account_id": "TARGET_ACCOUNT_ID"
  },
  "value": {
    "currency": "EUR",
    "amount": "25.00"
  },
  "description": "VRP payment"
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        The API validates each payment against the consent limits. If the payment exceeds the
        <code>max_single_amount</code>, would cause the monthly total to exceed
        <code>max_monthly_amount</code>, or would exceed the
        <code>max_number_of_monthly_transactions</code>, the request is rejected.
    </p>

    <h3>Revoking a VRP Consent</h3>

    <p>
        Users can revoke a VRP consent at any time. Once revoked, no further payments can be made
        under that consent. Outstanding payments are not affected.
    </p>

    <p>
        Users can manage their consents in the portal under <a href="/user/consents">My Consents</a>.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/consents">Consents</a> &mdash; general consent mechanism and account access consents</li>
        <li><a href="/developers/transaction-requests">Transaction Requests</a> &mdash; making individual payments</li>
        <li><a href="/developers/account-access">Account Access</a> &mdash; how Views control data access</li>
        <li><a href="/user/consents">My Consents</a> &mdash; manage your active consents</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=VRP" target="_blank" rel="noopener noreferrer">VRP endpoints</a> in the API Explorer</li>
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consent" target="_blank" rel="noopener noreferrer">Consent endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
