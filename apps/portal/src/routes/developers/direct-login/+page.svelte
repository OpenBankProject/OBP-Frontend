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
    <title>Direct Login - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Direct Login Authentication</h2>

    <p>
        Direct Login is the simplest way to authenticate with the OBP API. It is ideal for testing,
        scripts, and server-to-server communication. You exchange your credentials for a token in a
        single request.
    </p>

    <h3>Prerequisites</h3>

    <ul>
        <li>An OBP user account (<a href="/register">register here</a>)</li>
        <li>A registered consumer with a <code>consumer_key</code> (<a href="/developers/consumer-creation">create one here</a>)</li>
    </ul>

    <h3>Getting a Token</h3>

    <p>
        Send a POST request to the Direct Login endpoint with your credentials in the
        <code>Authorization</code> header:
    </p>

    <CodeBlock code={`POST /my/logins/direct

Authorization: DirectLogin username="YOUR_USERNAME",
  password="YOUR_PASSWORD",
  consumer_key="YOUR_CONSUMER_KEY"`} />

    <p>Example with curl:</p>

    <CodeBlock
        code={`curl -X POST "https://YOUR_OBP_HOST/my/logins/direct" \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: DirectLogin username="bob",password="secret",consumer_key="abc123"'`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>A successful response returns a token:</p>

    <CodeBlock code={`{
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}`} />

    <h3>Alternative: DirectLogin as Header Name</h3>

    <p>
        Instead of using the <code>Authorization</code> header, you can use <code>DirectLogin</code>
        as the header name directly. This avoids conflicts with other authentication mechanisms that
        may use the <code>Authorization</code> header:
    </p>

    <CodeBlock code={`DirectLogin: username="YOUR_USERNAME",
  password="YOUR_PASSWORD",
  consumer_key="YOUR_CONSUMER_KEY"`} />

    <p>And when using the token:</p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/accounts" \\
  -H "Content-Type: application/json" \\
  -H "DirectLogin: token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Using the Token</h3>

    <p>
        Include the token in the <code>Authorization</code> or <code>DirectLogin</code> header of subsequent API calls:
    </p>

    <p>Using the <code>Authorization</code> header:</p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/accounts" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>Using the <code>DirectLogin</code> header:</p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/accounts" \\
  -H "Content-Type: application/json" \\
  -H "DirectLogin: token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Token Lifetime</h3>

    <p>
        Direct Login tokens are long-lived by default but can be configured per OBP instance. You
        do not need to refresh the token &mdash; request a new one when the current one expires.
    </p>

    <h3>When to Use Direct Login</h3>

    <table>
        <thead>
            <tr>
                <th>Use case</th>
                <th>Recommended method</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Testing / exploration</td>
                <td>Direct Login</td>
            </tr>
            <tr>
                <td>Server-to-server scripts</td>
                <td>Direct Login</td>
            </tr>
            <tr>
                <td>Third-party app (user grants access)</td>
                <td><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a></td>
            </tr>
            <tr>
                <td>Open Banking / PSD2 flows</td>
                <td><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a></td>
            </tr>
        </tbody>
    </table>

    <h3>Security Considerations</h3>

    <ul>
        <li>Never use Direct Login in client-side (browser) code &mdash; your password would be exposed.</li>
        <li>Use environment variables or a secrets manager to store credentials.</li>
        <li>For production applications that act on behalf of other users, use <a href="/developers/oauth2-oidc">OAuth2</a> instead.</li>
    </ul>

    {#if ctx.apiExplorerUrl}
        <p>
            See the <a href="{ctx.apiExplorerUrl}/resource-docs?tags=API" target="_blank" rel="noopener noreferrer">Authentication endpoints</a> in the API Explorer for more details.
        </p>
    {/if}
</div>
