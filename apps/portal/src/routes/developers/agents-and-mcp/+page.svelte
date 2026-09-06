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
    // The OBP MCP server URL, advertised by the OBP backend via the app-directory
    // (public_obp_mcp_url). Falls back to a clearly-labelled placeholder when the
    // instance has not published one.
    const mcpUrl: string = ctx.mcpUrl || 'https://YOUR_OBP_MCP_HOST/mcp';
</script>

<svelte:head>
    <title>Agents and MCP - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>AI Agents and the Model Context Protocol</h2>

    <p>
        The Open Bank Project supports integration with AI agents through the
        <strong>Model Context Protocol (MCP)</strong>. MCP is an open standard that allows AI
        assistants and agents to discover and call APIs in a structured way.
    </p>

    <h3>What is MCP?</h3>

    <p>
        The Model Context Protocol provides a standardised way for AI models to interact with
        external tools and data sources. Instead of hard-coding API knowledge into an AI model, MCP
        lets the model discover available tools at runtime and call them with the correct parameters.
    </p>

    <p>
        Think of it as a universal adapter between AI agents and APIs. The agent asks "what can I
        do?" and the MCP server responds with a list of available tools, their parameters, and
        descriptions.
    </p>

    <h3>OBP MCP Server</h3>

    <p>
        The OBP MCP server exposes the OBP API as a set of tools that any MCP-compatible AI agent
        can use. It provides:
    </p>

    <ul>
        <li><strong>Endpoint discovery</strong> &mdash; list all available API endpoints, filtered by tag</li>
        <li><strong>Schema inspection</strong> &mdash; get the full request/response schema for any endpoint</li>
        <li><strong>API calls</strong> &mdash; make authenticated calls to the OBP API</li>
        <li><strong>Glossary access</strong> &mdash; look up OBP terminology and concepts</li>
    </ul>

    <h3>Available MCP Tools</h3>

    <table>
        <thead>
            <tr>
                <th>Tool</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>list_all_endpoint_tags</code></td>
                <td>List all API tags (categories) to discover available endpoint groups</td>
            </tr>
            <tr>
                <td><code>list_endpoints_by_tag</code></td>
                <td>List endpoints within a specific tag/category</td>
            </tr>
            <tr>
                <td><code>get_endpoint_schema</code></td>
                <td>Get the full schema (parameters, request body, response) for an endpoint</td>
            </tr>
            <tr>
                <td><code>call_obp_api</code></td>
                <td>Make an authenticated API call to any OBP endpoint</td>
            </tr>
            <tr>
                <td><code>list_glossary_terms</code></td>
                <td>List all glossary terms and their definitions</td>
            </tr>
            <tr>
                <td><code>get_glossary_term</code></td>
                <td>Get the full definition of a specific glossary term</td>
            </tr>
        </tbody>
    </table>

    <h3>Connecting a client</h3>

    <p>
        The OBP MCP server is a <strong>remote HTTP server</strong> &mdash; you connect to it by
        URL, there is nothing to install.
        {#if ctx.mcpUrl}
            This instance's server is at:
        {:else}
            Use the URL of your OBP MCP deployment (it ends in <code>/mcp</code>):
        {/if}
    </p>

    <CodeBlock code={mcpUrl} />

    <p>Add it to an MCP client such as Claude Code:</p>

    <CodeBlock code={`claude mcp add --transport http obp ${mcpUrl}
# then sign in (opens your browser):
claude mcp login obp`} />

    <p>
        Or add it directly to the client's configuration file (for example
        <code>.mcp.json</code> for Claude Code / Claude Desktop):
    </p>

    <CodeBlock code={`{
  "mcpServers": {
    "obp": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`} />

    <p>
        Authentication uses OAuth with your OBP account. On first connect the client opens a
        browser sign-in, then stores and refreshes the access token for you &mdash; there is no
        token to paste into the configuration. The server then calls the OBP API <em>as you</em>,
        limited to what your account is permitted to do.
    </p>

    <p>
        Once connected, the AI agent can discover and call OBP API endpoints autonomously. For
        example, you could ask Claude: &ldquo;List the banks available on this OBP instance&rdquo;
        and it will use the MCP tools to make the API call and return the results.
    </p>

    <h3>Using with Other AI Agents</h3>

    <p>
        Any AI agent or framework that supports MCP can connect to the OBP MCP server. This includes:
    </p>

    <ul>
        <li><strong>Claude Desktop</strong> &mdash; add the MCP server in settings</li>
        <li><strong>Claude Code</strong> &mdash; configure via <code>.mcp.json</code> in your project</li>
        <li><strong>Custom agents</strong> &mdash; use the MCP SDK to connect programmatically</li>
    </ul>

    <h3>Building Your Own Agent</h3>

    <p>
        You can build custom AI agents that interact with the OBP API by:
    </p>

    <ol>
        <li>Connecting to the OBP MCP server by URL and signing in (see above)</li>
        <li>Using an MCP client library to connect your agent to the server</li>
        <li>Letting your agent discover available tools and make API calls</li>
    </ol>

    <p>
        This enables powerful use cases like automated compliance checking, transaction monitoring,
        customer onboarding workflows, and natural language banking interfaces.
    </p>

    <h3>Resources</h3>

    <ul>
        <li><a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol specification</a></li>
        <li><a href="https://github.com/OpenBankProject" target="_blank" rel="noopener noreferrer">OBP GitHub organisation</a></li>
        <li><a href="/developers/opey">Opey</a> &mdash; the built-in OBP AI assistant</li>
        <li><a href="/developers/opey-permissions">What Opey Can Do</a> &mdash; consent-based authorisation for agents, explained</li>
        <li><a href="/developers/oauth2-oidc">OAuth2 / OIDC</a> &mdash; how sign-in to the MCP server works</li>
        {#if ctx.apiExplorerUrl}
            <li><a href={ctx.apiExplorerUrl} target="_blank" rel="noopener noreferrer">API Explorer</a> &mdash; browse all available endpoints</li>
        {/if}
    </ul>
</div>
