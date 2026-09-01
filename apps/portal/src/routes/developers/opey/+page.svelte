<script lang="ts">
    import { getContext } from 'svelte';

    const ctx: any = getContext('developerContext');
</script>

<svelte:head>
    <title>Opey - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>Opey &mdash; the OBP AI Assistant</h2>

    <p>
        Opey is an AI-powered assistant that helps you explore and understand the Open Bank Project
        API. You can ask Opey questions in natural language and it will help you find the right
        endpoints, explain concepts, and generate example requests.
    </p>

    <h3>What Can Opey Do?</h3>

    <ul>
        <li><strong>Find endpoints</strong> &mdash; ask "How do I list transactions?" and Opey will point you to the right API call</li>
        <li><strong>Explain concepts</strong> &mdash; ask "What is a View in OBP?" for a clear explanation</li>
        <li><strong>Generate examples</strong> &mdash; ask "Show me a curl command to get my accounts" for ready-to-use code</li>
        <li><strong>Troubleshoot errors</strong> &mdash; paste an error code like OBP-10404 and Opey will explain what went wrong</li>
        <li><strong>Navigate the API</strong> &mdash; ask about authentication, permissions, or any OBP topic</li>
    </ul>

    <h3>Where to Find Opey</h3>

    <p>
        Opey is available in the <strong>OBP Portal</strong> and the <strong>OBP API Manager</strong>.
        Look for the chat interface to start a conversation.
    </p>

    <h3>Tips for Getting the Best Results</h3>

    <ul>
        <li>Be specific about what you want to achieve, e.g. "I want to create a transaction request for a SEPA payment"</li>
        <li>Include context like the bank_id or account_id you're working with</li>
        <li>Ask follow-up questions to drill deeper into a topic</li>
        <li>You can paste JSON responses or error messages for Opey to analyse</li>
    </ul>

    <h3>Example Conversations</h3>

    <p><strong>Discovering endpoints:</strong></p>
    <blockquote>
        <p>"What endpoints do I need to create a counterparty and then make a payment to them?"</p>
    </blockquote>

    <p><strong>Understanding permissions:</strong></p>
    <blockquote>
        <p>"What entitlements does a user need to create accounts at a bank?"</p>
    </blockquote>

    <p><strong>Debugging:</strong></p>
    <blockquote>
        <p>"I'm getting OBP-20001 when I try to call /my/accounts. What does this mean?"</p>
    </blockquote>

    <h3>Opey and the API</h3>

    <p>
        Opey has access to the full OBP API specification, including all endpoints, request/response
        schemas, glossary terms, and error codes. It stays up to date with the API so you always get
        accurate information.
    </p>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/opey-permissions">What Opey Can Do</a> &mdash; consents, entitlements and what Opey may do on your behalf</li>
        <li><a href="/developers/agents-and-mcp">Agents and MCP</a> &mdash; connect your own AI agents to the OBP API</li>
        {#if ctx.apiExplorerUrl}
            <li><a href={ctx.apiExplorerUrl} target="_blank" rel="noopener noreferrer">API Explorer</a> &mdash; browse and test endpoints</li>
        {/if}
    </ul>
</div>
