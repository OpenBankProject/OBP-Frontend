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
    import { explorerResourceDocUrl } from '@obp/shared/explorer';

    let { data } = $props();

    const ctx: any = getContext('developerContext');
    const wellKnownUrl = `${ctx.apiBaseUrl}/obp/v5.1.0/well-known`;
</script>

<svelte:head>
    <title>OAuth2 / OIDC - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>OAuth2 and OpenID Connect</h2>

    <p>
        OAuth2 is the recommended authentication method for production applications, especially when
        your app needs to act on behalf of other users. OBP supports the standard OAuth2
        Authorization Code flow, and can integrate with OpenID Connect (OIDC) identity providers.
    </p>

    <h3>Prerequisites</h3>

    <ul>
        <li>A registered consumer with a valid <strong>Redirect URL</strong> (<a href="/developers/consumer-creation">register here</a>)</li>
        <li>Your <code>consumer_key</code> (used as <code>client_id</code>) and <code>consumer_secret</code> (used as <code>client_secret</code>)</li>
    </ul>

    <h3>Authorization Code Flow</h3>

    <h4>Step 1: Redirect the user to authorise</h4>

    <p>Direct the user's browser to the OBP authorisation endpoint:</p>

    <CodeBlock
        code={`GET https://YOUR_OBP_HOST/oauth/authorize?client_id=YOUR_CONSUMER_KEY
  &redirect_uri=YOUR_REDIRECT_URL
  &response_type=code
  &state=RANDOM_STATE_STRING`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        The user will log in (if not already) and be asked to grant your application access. After
        approval, they are redirected back to your <code>redirect_uri</code> with an authorisation
        <code>code</code>.
    </p>

    <h4>Step 2: Exchange the code for a token</h4>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/oauth/token

Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=THE_AUTH_CODE
&redirect_uri=YOUR_REDIRECT_URL
&client_id=YOUR_CONSUMER_KEY
&client_secret=YOUR_CONSUMER_SECRET`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>The response includes an access token:</p>

    <CodeBlock code={`{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}`} />

    <h4>Step 3: Use the access token</h4>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/accounts" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Refreshing Tokens</h3>

    <p>When the access token expires, use the refresh token to obtain a new one:</p>

    <CodeBlock
        code={`POST https://YOUR_OBP_HOST/oauth/token

grant_type=refresh_token
&refresh_token=YOUR_REFRESH_TOKEN
&client_id=YOUR_CONSUMER_KEY
&client_secret=YOUR_CONSUMER_SECRET`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>OpenID Connect (OIDC)</h3>

    <p>
        OBP can be configured to use an external OIDC identity provider (e.g. Keycloak, Auth0,
        Azure AD) for authentication. In this setup:
    </p>

    <ul>
        <li>The identity provider handles user login and issues ID tokens.</li>
        <li>OBP validates the tokens and creates/maps users internally.</li>
        <li>Your application follows the standard OIDC Authorization Code flow with the identity provider.</li>
    </ul>

    <h4>Identity providers on this instance</h4>

    {#if data.identityProviders.length > 0}
        <table data-testid="identity-providers">
            <thead>
                <tr>
                    <th>Provider</th>
                    <th>Discovery document</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {#each data.identityProviders as idp (idp.provider)}
                    <tr data-testid="identity-provider-{idp.provider}">
                        <td><code>{idp.provider}</code></td>
                        <td>
                            {#if idp.discoveryUrl}
                                <a href={idp.discoveryUrl} target="_blank" rel="noopener noreferrer">{idp.discoveryUrl}</a>
                            {/if}
                        </td>
                        <td>
                            {#if idp.statusUrl}
                                <a href={idp.statusUrl} target="_blank" rel="noopener noreferrer" data-testid="identity-provider-status-link">Status page</a>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else}
        <p data-testid="identity-providers-empty">No OIDC providers are reported by this instance.</p>
    {/if}

    <p>
        The list comes from
        <a href={wellKnownUrl} target="_blank" rel="noopener noreferrer"><code>GET /obp/v5.1.0/well-known</code></a>{#if ctx.apiExplorerUrl}
            (<a href={explorerResourceDocUrl('OBPv5.1.0-getOAuth2ServerWellKnown', ctx.apiExplorerUrl)} target="_blank" rel="noopener noreferrer">API Explorer</a>){/if}.
    </p>

    <h3>Security Best Practices</h3>

    <ul>
        <li>Always use the <code>state</code> parameter to prevent CSRF attacks.</li>
        <li>Store tokens securely &mdash; never in localStorage or URLs.</li>
        <li>Use PKCE (Proof Key for Code Exchange) for public clients (SPAs, mobile apps).</li>
        <li>Keep your <code>client_secret</code> on the server side only.</li>
        <li>Request only the scopes your application needs.</li>
    </ul>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/consents">Consents</a> &mdash; grant third-party access to accounts</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consent" target="_blank" rel="noopener noreferrer">Consent endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
