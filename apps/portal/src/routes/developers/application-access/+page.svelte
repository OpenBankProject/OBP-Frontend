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
    <title>Application Access - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Application Access</h2>

    <p>
        Some API calls need to be made on behalf of an application rather than a specific user.
        OBP supports two approaches for this: <strong>Client Credentials</strong> (OAuth2) and
        <strong>Consumer authentication</strong> using a <code>consumer_key</code>.
    </p>

    <h3>When to Use Application Access</h3>

    <p>
        Application-level access is appropriate when:
    </p>

    <ul>
        <li>Your application needs to call endpoints that don't require a user context (e.g. listing banks, getting API info)</li>
        <li>You are building a backend service that acts as itself, not on behalf of a user</li>
        <li>You want to identify your application to the API without a user login</li>
    </ul>

    <p>
        For endpoints that access user data (accounts, transactions, etc.), you still need
        user-level authentication via <a href="/developers/direct-login">Direct Login</a> or
        <a href="/developers/oauth2-oidc">OAuth2 Authorization Code</a>.
    </p>

    <h3>Client Credentials Grant (OAuth2)</h3>

    <p>
        The OAuth2 Client Credentials grant lets your application obtain an access token using its
        <code>client_id</code> and <code>client_secret</code> (which are your
        <code>consumer_key</code> and <code>consumer_secret</code> from
        <a href="/developers/consumer-creation">consumer registration</a>).
    </p>

    <h4>Getting a Token</h4>

    <CodeBlock
        code={`curl -X POST "https://YOUR_OBP_HOST/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CONSUMER_KEY" \\
  -d "client_secret=YOUR_CONSUMER_SECRET"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>A successful response returns an access token:</p>

    <CodeBlock code={`{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}`} />

    <h4>Using the Token</h4>

    <p>Include the token in the <code>Authorization</code> header:</p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h4>When the Token Expires</h4>

    <p>
        Client Credentials tokens have a limited lifetime (typically 1 hour). When the token
        expires, request a new one &mdash; there is no refresh token with this grant type.
    </p>

    <h3>Consumer Authentication (consumer_key)</h3>

    <p>
        For simpler use cases, you can identify your application by passing the
        <code>consumer_key</code> directly. This does not authenticate a user but tells the API
        which application is making the request.
    </p>

    <h4>As a Query Parameter</h4>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks?consumer_key=YOUR_CONSUMER_KEY"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h4>Checking Your Consumer</h4>

    <p>
        You can verify which consumer is associated with your current authentication{#if ctx.apiExplorerUrl}
        (<a href="{ctx.apiExplorerUrl}/resource-docs?operationid=OBPv6.0.0-getCurrentConsumer" target="_blank" rel="noopener noreferrer">see in API Explorer</a>){/if}:
    </p>

    <CodeBlock code="GET /obp/v6.0.0/consumers/current" />

    <h3>Comparison</h3>

    <table>
        <thead>
            <tr>
                <th>Feature</th>
                <th>Client Credentials</th>
                <th>Consumer Key</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Authentication level</td>
                <td>Application (OAuth2 token)</td>
                <td>Application identification only</td>
            </tr>
            <tr>
                <td>Secret required</td>
                <td>Yes (<code>client_secret</code>)</td>
                <td>No (key only)</td>
            </tr>
            <tr>
                <td>Token-based</td>
                <td>Yes (Bearer token)</td>
                <td>No (key passed directly)</td>
            </tr>
            <tr>
                <td>Rate limiting</td>
                <td>Per application</td>
                <td>Per application</td>
            </tr>
            <tr>
                <td>Access user data</td>
                <td>No (app-level only)</td>
                <td>No (app-level only)</td>
            </tr>
            <tr>
                <td>Best for</td>
                <td>Backend services, secure environments</td>
                <td>Public endpoints, simple identification</td>
            </tr>
        </tbody>
    </table>

    <h3>Security Considerations</h3>

    <ul>
        <li>Never expose your <code>consumer_secret</code> in client-side code or public repositories.</li>
        <li>The <code>consumer_key</code> alone does not grant access to protected data, but treat it as semi-sensitive &mdash; it identifies your application.</li>
        <li>Use Client Credentials over consumer key authentication when your environment supports it, as it provides a stronger security model.</li>
        <li>For accessing user data, always use user-level authentication (<a href="/developers/direct-login">Direct Login</a> or <a href="/developers/oauth2-oidc">OAuth2 Authorization Code</a>).</li>
    </ul>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/consumer-creation">Consumer Creation</a> &mdash; register your application to get a consumer key and secret</li>
        <li><a href="/developers/direct-login">Direct Login</a> &mdash; user-level authentication for testing</li>
        <li><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a> &mdash; user-level OAuth2 Authorization Code flow</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consumer" target="_blank" rel="noopener noreferrer">Consumer endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
