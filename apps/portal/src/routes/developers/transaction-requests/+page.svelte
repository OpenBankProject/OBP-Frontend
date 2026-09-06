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
    <title>Transaction Requests - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Transaction Requests</h2>

    <p>
        In OBP, payments are made via <strong>Transaction Requests</strong>. A Transaction Request
        is an instruction to move money from one account to another. It goes through a lifecycle
        of validation, optional challenge (e.g. OTP), and completion before a Transaction is created.
    </p>

    <h3>How It Works</h3>

    <ol>
        <li><strong>Create a Transaction Request</strong> &mdash; specify the from account, to account, amount, and payment type</li>
        <li><strong>Challenge (optional)</strong> &mdash; if the amount exceeds a threshold or policy requires it, the user must answer a challenge (e.g. enter an OTP)</li>
        <li><strong>Answer the Challenge</strong> &mdash; submit the challenge response to authorise the payment</li>
        <li><strong>Transaction Created</strong> &mdash; once authorised, the system creates the actual Transaction</li>
    </ol>

    <h3>Transaction Request Types</h3>

    <p>
        OBP supports several payment types. The type determines what fields are required and how
        the payment is routed:
    </p>

    <table>
        <thead>
            <tr>
                <th>Type</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>SANDBOX_TAN</code></td>
                <td>Transfer between accounts on the same OBP sandbox instance. Good for testing.</td>
            </tr>
            <tr>
                <td><code>ACCOUNT</code></td>
                <td>Transfer to another account identified by bank_id and account_id.</td>
            </tr>
            <tr>
                <td><code>ACCOUNT_OTP</code></td>
                <td>Same as ACCOUNT but always requires an OTP challenge.</td>
            </tr>
            <tr>
                <td><code>COUNTERPARTY</code></td>
                <td>Transfer to a pre-registered counterparty.</td>
            </tr>
            <tr>
                <td><code>SEPA</code></td>
                <td>SEPA credit transfer using an IBAN.</td>
            </tr>
            <tr>
                <td><code>FREE_FORM</code></td>
                <td>Flexible format for custom payment types.</td>
            </tr>
            <tr>
                <td><code>SIMPLE</code></td>
                <td>Simple transfer with minimal required fields.</td>
            </tr>
        </tbody>
    </table>

    <h3>Creating a Transaction Request</h3>

    <p>
        First, check which transaction request types are supported for your account:
    </p>

    <CodeBlock code="GET /obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transaction-request-types" />

    <p>
        Then create a Transaction Request. Here is an example using the <code>ACCOUNT</code> type{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-createTransactionRequestAccount" target="_blank" rel="noopener noreferrer">see full schema in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="POST /obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transaction-request-types/ACCOUNT/transaction-requests" />

    <p>Request body:</p>

    <CodeBlock code={`{
  "to": {
    "bank_id": "TARGET_BANK_ID",
    "account_id": "TARGET_ACCOUNT_ID"
  },
  "value": {
    "currency": "EUR",
    "amount": "10.00"
  },
  "description": "Payment for invoice #123"
}`} />

    <p>Example with curl:</p>

    <CodeBlock
        code={`curl -X POST "https://YOUR_OBP_HOST/obp/v6.0.0/banks/my-bank/accounts/my-account/owner/transaction-request-types/ACCOUNT/transaction-requests" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN" \\
  -d '{
    "to": {
      "bank_id": "target-bank",
      "account_id": "target-account"
    },
    "value": {
      "currency": "EUR",
      "amount": "10.00"
    },
    "description": "Test payment"
  }'`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Handling Challenges</h3>

    <p>
        If the response includes a <code>challenge</code> object with a <code>challenge_type</code>
        and <code>id</code>, the payment requires authorisation:
    </p>

    <CodeBlock code={`{
  "id": "txn-req-123",
  "type": "ACCOUNT",
  "status": "INITIATED",
  "challenge": {
    "id": "challenge-456",
    "challenge_type": "OBP_TRANSACTION_REQUEST_CHALLENGE",
    "allowed_attempts": 3
  }
}`} />

    <p>Answer the challenge{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-answerTransactionRequestChallenge" target="_blank" rel="noopener noreferrer">see full schema in API Explorer</a>){/if}:</p>

    <CodeBlock code="POST /obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transaction-request-types/ACCOUNT/transaction-requests/TXN_REQ_ID/challenge" />

    <CodeBlock code={`{
  "id": "challenge-456",
  "answer": "123456"
}`} />

    <h3>SEPA Payments</h3>

    <p>For SEPA transfers, use the <code>SEPA</code> type with an IBAN:</p>

    <CodeBlock code={`{
  "to": {
    "iban": "DE89370400440532013000"
  },
  "value": {
    "currency": "EUR",
    "amount": "25.00"
  },
  "description": "SEPA payment",
  "charge_policy": "SHARED"
}`} />

    <h3>Counterparty Payments</h3>

    <p>To pay a pre-registered counterparty, reference it by ID{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv4.0.0-createTransactionRequestCounterparty" target="_blank" rel="noopener noreferrer">see full schema in API Explorer</a>){/if}:</p>

    <CodeBlock code={`{
  "to": {
    "counterparty_id": "cpty-789"
  },
  "value": {
    "currency": "EUR",
    "amount": "50.00"
  },
  "description": "Payment to supplier"
}`} />

    <h3>Transaction Request Status</h3>

    <p>You can check the status of your transaction requests:</p>

    <CodeBlock code="GET /obp/v6.0.0/banks/BANK_ID/accounts/ACCOUNT_ID/VIEW_ID/transaction-requests" />

    <p>Possible statuses:</p>

    <ul>
        <li><strong>INITIATED</strong> &mdash; created, awaiting challenge response</li>
        <li><strong>COMPLETED</strong> &mdash; payment executed, transaction created</li>
        <li><strong>FAILED</strong> &mdash; payment failed (insufficient funds, validation error, etc.)</li>
    </ul>

    <h3>Required Entitlements</h3>

    <p>
        To create transaction requests, the user typically needs to be the account owner or have
        access via a View that permits payments. No special entitlements are required for the account
        owner to make payments from their own accounts.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/obp-concepts">OBP Concepts</a> &mdash; understand accounts, views, and the data model</li>
        <li><a href="/developers/consents">Consents</a> &mdash; Variable Recurring Payments (VRP) using consents</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Transaction-Request" target="_blank" rel="noopener noreferrer">All Transaction Request endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
