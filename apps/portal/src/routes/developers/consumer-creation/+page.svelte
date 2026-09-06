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
    <title>Consumer Creation - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Register Your Application</h2>

    <p>
        Before your application can make authenticated API calls, you need to register it as a
        <strong>Consumer</strong>. This gives you a <code>consumer_key</code> and
        <code>consumer_secret</code> that identify your app.
    </p>

    <h3>How to Register</h3>

    <ol>
        <li>Make sure you are <a href="/login">logged in</a> to the portal.</li>
        <li>Go to <a href="/consumers/register">Get API Key</a>.</li>
        <li>Fill in the registration form:
            <ul>
                <li><strong>App Name</strong> &mdash; a human-readable name for your application</li>
                <li><strong>App Type</strong> &mdash; web, mobile, or other</li>
                <li><strong>Description</strong> &mdash; what your application does</li>
                <li><strong>Developer Email</strong> &mdash; your contact email</li>
                <li><strong>Redirect URL</strong> &mdash; the OAuth callback URL (required for OAuth2 flows)</li>
            </ul>
        </li>
        <li>Submit the form. You will receive your <code>consumer_key</code> and <code>consumer_secret</code>.</li>
    </ol>

    <h3>Important Notes</h3>

    <ul>
        <li>
            Keep your <code>consumer_secret</code> safe. Do not expose it in client-side code or
            public repositories.
        </li>
        <li>
            Your consumer may need to be approved by an administrator before it can be used,
            depending on the OBP instance configuration.
        </li>
        <li>
            You can view and manage your registered consumers in
            <a href="/user/consumers">My Consumers</a>.
        </li>
    </ul>

    <h3>Using Your Consumer Key</h3>

    <p>
        The consumer key is used during the authentication process. For Direct Login, it is included
        in the <code>Authorization</code> header:
    </p>

    <CodeBlock code={`Authorization: DirectLogin username="YOUR_USERNAME",
  password="YOUR_PASSWORD",
  consumer_key="YOUR_CONSUMER_KEY"`} />

    <p>
        For OAuth2 flows, the consumer key is the <code>client_id</code> and the consumer secret is
        the <code>client_secret</code>.
    </p>

    {#if ctx.apiExplorerUrl}
        <p>
            See the <a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consumer" target="_blank" rel="noopener noreferrer">Consumer endpoints</a> in the API Explorer for programmatic consumer management.
        </p>
    {/if}

    <h3>Next Steps</h3>

    <ul>
        <li><a href="/developers/direct-login">Direct Login</a> &mdash; authenticate using your consumer key</li>
        <li><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a> &mdash; set up OAuth2 authentication</li>
    </ul>
</div>
