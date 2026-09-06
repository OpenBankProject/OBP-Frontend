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
    <title>Consents - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Consents</h2>

    <p>
        Consents in OBP allow a user to grant a third-party application access to their account
        data or to make payments on their behalf. Consents are central to Open Banking and PSD2
        compliance. For recurring payments, see
        <a href="/developers/variable-recurring-payments">Variable Recurring Payments</a>.
    </p>

    <h3>How Consents Work</h3>

    <ol>
        <li><strong>Create a consent</strong> &mdash; the third-party app requests a consent specifying which accounts and views it needs access to</li>
        <li><strong>User authorises</strong> &mdash; the account holder reviews and approves the consent (via redirect, OTP, or SCA)</li>
        <li><strong>Access granted</strong> &mdash; the app receives a consent JWT that it can use to access the permitted resources</li>
        <li><strong>Consent expires or is revoked</strong> &mdash; consents have a time limit and can be revoked by the user at any time</li>
    </ol>

    <h3>Account Access Consents</h3>

    <p>
        Account access consents grant read access to account data (balances, transactions, etc.)
        for a limited time. This is the standard Open Banking / PSD2 Account Information Service
        (AIS) flow.
    </p>

    <h4>Creating an Account Access Consent</h4>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/my/consents/SCA_METHOD

{
  "everything": false,
  "account_access": [
    {
      "account_routing": {
        "scheme": "AccountId",
        "address": "ACCOUNT_ID"
      },
      "view_id": "owner"
    }
  ],
  "entitlements": [],
  "consumer_id": "CONSUMER_ID_OF_TPP",
  "valid_from": "2026-01-01T00:00:00Z",
  "time_to_live": 3600
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        The <code>SCA_METHOD</code> determines how the user authorises the consent. Options include
        <code>SMS</code>, <code>EMAIL</code>, and <code>IMPLICIT</code>.
    </p>

    <h4>Answering the Consent Challenge</h4>

    <p>
        After creation, the user receives a challenge (e.g. an OTP via SMS or email). Answer it to
        activate the consent:
    </p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/obp/v6.0.0/banks/BANK_ID/consents/CONSENT_ID/challenge

{
  "answer": "123456"
}`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h4>Using the Consent</h4>

    <p>
        Once authorised, the consent response includes a JWT. The third-party application includes
        this JWT in API calls to access the permitted account data:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/banks/BANK_ID/accounts/ACCOUNT_ID/owner/transactions" \\
  -H "Content-Type: application/json" \\
  -H "Consent-JWT: YOUR_CONSENT_JWT"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Managing Consents</h3>

    <p>Users can view and revoke their consents:</p>

    <CodeBlock code="GET /obp/v6.0.0/banks/BANK_ID/my/consents" />

    <CodeBlock code="DELETE /obp/v6.0.0/banks/BANK_ID/my/consents/CONSENT_ID" />

    <p>
        You can also manage your consents in the portal under <a href="/user/consents">My Consents</a>.
    </p>

    <h3>Consent Status</h3>

    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>INITIATED</code></td>
                <td>Consent created, awaiting user authorisation</td>
            </tr>
            <tr>
                <td><code>ACCEPTED</code></td>
                <td>User has authorised the consent, it is now active</td>
            </tr>
            <tr>
                <td><code>REJECTED</code></td>
                <td>User rejected the consent request</td>
            </tr>
            <tr>
                <td><code>REVOKED</code></td>
                <td>User revoked a previously active consent</td>
            </tr>
        </tbody>
    </table>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/variable-recurring-payments">Variable Recurring Payments</a> &mdash; VRP consents for recurring payments</li>
        <li><a href="/developers/account-access">Account Access</a> &mdash; how Views control data access</li>
        <li><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a> &mdash; authentication flows for third-party apps</li>
        <li><a href="/developers/transaction-requests">Transaction Requests</a> &mdash; making payments</li>
        <li><a href="/developers/opey-permissions">What Opey Can Do</a> &mdash; how the AI assistant uses consents built from your entitlements</li>
        <li><a href="/user/consents">My Consents</a> &mdash; manage your active consents</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consent" target="_blank" rel="noopener noreferrer">Consent endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
