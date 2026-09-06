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
    <title>Getting Started - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Welcome to the Open Bank Project API</h2>

    <p>
        The Open Bank Project (OBP) provides a RESTful API for accessing banking data and services.
        Whether you're building a fintech app, integrating banking data into your platform, or
        exploring open banking, this guide will help you get started.
    </p>

    <h3>Quick Start</h3>

    <ol>
        <li>
            <strong>Register an account</strong> &mdash; <a href="/register">Sign up</a> for an account on this portal.
        </li>
        <li>
            <strong>Get an API key</strong> &mdash; <a href="/developers/consumer-creation">Register a consumer</a> (your application) to receive a consumer key and secret.
        </li>
        <li>
            <strong>Authenticate</strong> &mdash; Use <a href="/developers/direct-login">Direct Login</a> or <a href="/developers/oauth2-oidc">OAuth2 / OIDC</a> to obtain an access token.
        </li>
        <li>
            <strong>Make API calls</strong> &mdash; Use your access token to call the OBP API endpoints.
        </li>
        <li>
            <strong>Explore</strong> &mdash; Use the <a href="/developers/api-explorer">API Explorer</a> to browse and test all available endpoints.
        </li>
    </ol>

    <h3>Your First API Call</h3>

    <p>
        Some endpoints are public and don't require authentication. For example, you can list available banks:
    </p>

    <CodeBlock code="GET /obp/v6.0.0/banks" />

    <p>Try it with curl:</p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/banks" \\
  -H "Content-Type: application/json"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        For authenticated endpoints, include your token in the <code>Authorization</code> header:
    </p>

    <CodeBlock
        code={`curl -X GET "https://YOUR_OBP_HOST/obp/v6.0.0/my/accounts" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: DirectLogin token=YOUR_TOKEN"`}
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <h3>Key Resources</h3>

    <ul>
        <li><a href="/developers/obp-concepts">OBP Concepts</a> &mdash; understand the core data model and terminology</li>
        <li><a href="/developers/consumer-creation">Consumer Creation</a> &mdash; register your application</li>
        <li><a href="/developers/direct-login">Direct Login</a> &mdash; the simplest authentication method for testing</li>
        <li><a href="/developers/api-explorer">API Explorer</a> &mdash; browse and test all endpoints interactively</li>
        <li><a href="/developers/opey">Opey</a> &mdash; use the AI assistant to explore the API</li>
    </ul>

    <h3>Base URL</h3>

    <p>
        All API endpoints are relative to the OBP API base URL. The format is:
    </p>

    <CodeBlock
        code="https://YOUR_OBP_HOST/obp/v6.0.0/"
        apiHost={ctx.apiHost}
        showHost={true}
    />

    <p>
        The current API version is <strong>v6.0.0</strong>.
    </p>

    <h3>Response Format</h3>

    <p>
        The API returns JSON responses. Successful requests return the requested data. Errors return
        a JSON object with a <code>code</code> and <code>message</code> field:
    </p>

    <CodeBlock code={`{
  "code": 400,
  "message": "OBP-10001: Incorrect json format."
}`} />

    <p>
        You can look up any error code in the
        <a href={ctx.apiExplorerUrl ? `${ctx.apiExplorerUrl}/glossary` : '/developers/obp-concepts'}>Glossary</a>.
    </p>

    <h3>Rate Limiting</h3>

    <p>
        API calls may be subject to rate limiting depending on your OBP instance configuration. If you
        receive a <code>429 Too Many Requests</code> response, wait before retrying.
    </p>
</div>
