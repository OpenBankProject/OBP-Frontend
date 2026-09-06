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
    <title>What Opey Can Do - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>What Opey Can and Cannot Do on Your Behalf</h2>

    <p>
        Opey is an AI agent. When it calls the OBP API for you it does <strong>not</strong> use your
        login. Every action runs under a short-lived <a href="/developers/consents">Consent</a> that
        you approve in the chat, and that consent is built from the
        <a href="/user/entitlements">Entitlements</a> and account Views you hold at that moment.
        This page explains the moving parts and what they mean in practice.
    </p>

    <h3>The Terms</h3>

    <table>
        <thead>
            <tr>
                <th>Term</th>
                <th>Meaning</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Entitlement</strong></td>
                <td>A Role granted to a User, optionally scoped to one bank: the pair <code>(role_name, bank_id)</code>. System-wide roles have an empty <code>bank_id</code>. See your own on the <a href="/user/entitlements">Entitlements</a> page.</td>
            </tr>
            <tr>
                <td><strong>View</strong></td>
                <td>Permission to see or act on a specific account: the triple <code>(bank_id, account_id, view_id)</code>, e.g. <code>owner</code> or <code>auditor</code>. See <a href="/developers/account-access">Account Access</a>.</td>
            </tr>
            <tr>
                <td><strong>My resources</strong></td>
                <td>Your own personal records that a consent may act on for you, for example your rows in a personal dynamic entity: the entry <code>(bank_id, entity_name, actions)</code> under <code>my_resources</code>. Owned rather than granted, so no role is involved and nothing can be "not held". Records Opey writes this way belong to you.</td>
            </tr>
            <tr>
                <td><strong>Consent</strong></td>
                <td>A signed grant (a JWT) that lets a Consumer act with a fixed list of entitlements, views and my resources for a limited time. Opey's consents last one hour.</td>
            </tr>
            <tr>
                <td><strong>Consent user</strong></td>
                <td>The identity OBP creates for each consent. Calls made with the consent JWT run as this user, which holds <em>exactly</em> the entitlements and views embedded in the JWT and nothing else.</td>
            </tr>
            <tr>
                <td><strong>Accountable user</strong></td>
                <td>The human who granted the consent: the owner of anything durable the call creates. Endpoints that have been made consent-aware attribute their side effects to this user rather than to the consent user; not every endpoint has been, see <em>Three Identities, One Job Each</em> and <em>Attribution is not yet universal</em> below.</td>
            </tr>
            <tr>
                <td><strong>Consent reference id</strong></td>
                <td>A stable identifier for a consent, recorded on every API call made with it. Filter your <a href="/user/my-activity-dashboard">Activity Dashboard</a> by it to see exactly what Opey did.</td>
            </tr>
        </tbody>
    </table>

    <h3>How One Tool Call Gets Authorised</h3>

    <ol>
        <li><strong>Opey calls the API without credentials.</strong> The OBP MCP server replies <code>consent_required</code>, naming the endpoint and the roles its resource doc requires. Nothing has reached OBP yet.</li>
        <li><strong>The chat shows a consent card.</strong> It lists the exact entitlement pairs the consent will carry, computed from your current entitlements, any account views you picked in the <em>Working accounts</em> picker, and, for actions on your own records, which of them Opey may read or write.</li>
        <li><strong>You click Grant.</strong> The Portal re-reads your entitlements from OBP, picks the stored pair for each required role, reuses an existing unexpired consent if one already covers the request, and otherwise creates a new one. Your login token never leaves the Portal.</li>
        <li><strong>Opey retries with the consent JWT.</strong> OBP runs the call as the consent user. Opey keeps the JWT for later calls that need the same roles, until it expires.</li>
        <li><strong>You can watch it.</strong> The chip under the chat input shows the consent Opey is using now, with its reference id and the roles and views it carries.</li>
    </ol>

    <h3>What Opey Can Do</h3>

    <ul>
        <li><strong>Anything your entitlements allow</strong> at the moment you grant the consent, limited to the pairs that consent embeds. If you hold <code>CanCreateBank</code>, Opey can create a bank. If you hold <code>CanCreateAccount</code> at <code>bank-a</code>, it can open accounts there and nowhere else.</li>
        <li><strong>Read or act on accounts you picked.</strong> View-scoped endpoints (balances, transactions, account details) work only for the <code>(bank, account, view)</code> triples you selected in the Working accounts picker. No pick, no data.</li>
        <li><strong>Grant roles at a bank you administer.</strong> If you hold <code>CanCreateEntitlementAtOneBank</code> at a bank, Opey can add roles to users at that bank under a consent carrying that pair. Creating a bank grants you this role there automatically.</li>
        <li><strong>Create things that belong to you, where the endpoint supports it.</strong> Roles Opey grants always go to humans, a bank Opey creates grants its admin role to you, and an account opened through the v7 endpoint is held by you. Every call is logged against your user and the consent's reference id.</li>
        <li><strong>Work on your own records.</strong> Personal dynamic entity endpoints (the <code>/my</code> routes) need no role from you, but Opey reaches them only through a consent whose <code>my_resources</code> names the entity and whether it may read or write. What it writes there is yours, not the consent user's.</li>
        <li><strong>Reuse a consent.</strong> Repeat actions needing the same roles, views and my resources reuse the same consent for up to an hour, so you are not asked again and again.</li>
    </ul>

    <h3>What Opey Cannot Do</h3>

    <ul>
        <li><strong>Exceed your entitlements.</strong> OBP refuses to put a pair into a consent that you do not hold (<code>OBP-35013</code>). If a required role is missing, the consent card tells you which role at which bank, and what to do next.</li>
        <li><strong>Use entitlements you gain later.</strong> A consent is a snapshot. Roles you receive after it was created, whether granted by an admin or as a side effect of an earlier Opey action, are invisible to it. Retry the action and grant a fresh consent; the chat shows a notice when this happens.</li>
        <li><strong>Hold the system-wide granting role.</strong> <code>CanCreateEntitlementAtAnyBank</code> is never allowed in a consent (<code>OBP-35033</code>), even if you hold it. Grant yourself the bank-scoped <code>CanCreateEntitlementAtOneBank</code> first, then Opey can grant roles at that bank.</li>
        <li><strong>Use virtual roles.</strong> Super admin powers are not stored entitlements, so they cannot be embedded in a consent. Opey acting for a super admin has only that admin's stored pairs.</li>
        <li><strong>See your login.</strong> Opey never receives your session, OAuth token, or DirectLogin token, and it will never ask for one. If it appears to, deny the request.</li>
        <li><strong>Hold roles itself.</strong> The consent user cannot be granted durable roles. A grant that names it is either redirected to you or rejected, so nothing accumulates on the agent identity. Other kinds of durable object can still end up attached to it, see above.</li>
    </ul>

    <h3>Three Identities, One Job Each</h3>

    <p>
        Every call Opey makes involves three identities, and the design is easiest to reason about
        when each is given exactly one job.
    </p>

    <ul>
        <li><strong>The consent user is the actor.</strong> It authenticates the call, its embedded entitlements and views are what OBP checks, and it is what the API metrics record as <code>user_id</code>. That is correct and deliberate: the log says truthfully that this agent identity made this call.</li>
        <li><strong>The consent reference id is the link.</strong> It is stamped on every metric row for the call, and it is how you get from the actor back to the human who granted the consent and to the exact scope they granted.</li>
        <li><strong>The accountable user is the owner.</strong> Anything durable the call creates for a person, grants to a person, or links to a person records this id, never the consent user's.</li>
    </ul>

    <p>
        The agent owns nothing durable. The only rows that belong to the consent user are the
        consent's own authorisation, its views and its copied entitlements, and they belong to it
        precisely so that they die with it. Everything else is the human's.
    </p>

    <p>
        There is no single switch that makes this true, because OBP was written with one user id
        doing all three jobs. Every place that stores a user reference has to be visited once and
        told which job it is doing. That is a one-time sort rather than an ongoing judgement call,
        and it is what the section after next tracks.
    </p>

    <h3>An Old Pattern: Real and Effective Identity</h3>

    <p>
        This split is not new. Systems that take delegation seriously have carried two identities
        per request for decades. OBP is adopting the same model: the consent user is the
        <em>effective</em> identity, the accountable user is the <em>real</em> one, and the consent
        reference id is the audit link between them.
    </p>

    <table>
        <thead>
            <tr>
                <th>System</th>
                <th>Effective identity (permissions)</th>
                <th>Real identity (ownership, audit)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Unix</td>
                <td><code>euid</code> after <code>setuid</code>, or the target user under <code>sudo</code></td>
                <td><code>ruid</code>, and <code>SUDO_USER</code> in the log</td>
            </tr>
            <tr>
                <td>PostgreSQL</td>
                <td><code>current_user</code> after <code>SET ROLE</code></td>
                <td><code>session_user</code></td>
            </tr>
            <tr>
                <td>SQL Server</td>
                <td>the principal named in <code>EXECUTE AS</code></td>
                <td><code>ORIGINAL_LOGIN()</code></td>
            </tr>
            <tr>
                <td>OAuth token exchange (RFC 8693)</td>
                <td><code>act</code>, the acting party</td>
                <td><code>sub</code>, the party acted for</td>
            </tr>
            <tr>
                <td><strong>OBP under a consent</strong></td>
                <td><strong>consent user</strong>: embedded entitlements and views, metrics <code>user_id</code></td>
                <td><strong>accountable user</strong>: creator, holder, grant target; linked by <code>consent_reference_id</code></td>
            </tr>
        </tbody>
    </table>

    <p>
        In each of these, permission checks use the effective identity and anything durable is
        recorded against the real one, and the storage layer applies that default so individual
        code paths do not have to remember it. That is the direction OBP is taking: the consent
        user keeps the isolation that makes authorisation watertight, and the persistence layer
        resolves the accountable user for everything it creates on a person's behalf. The
        alternatives, letting the agent act fully as the human or making the agent a durable
        principal of its own, are not open here: the first would bypass the consent's scope, and
        the second would leave objects owned by an identity that expires in an hour.
    </p>

    <h3>Attribution Is Not Yet Universal</h3>

    <p>
        Calls run as the consent user so that authorisation is watertight. The flip side is that any
        endpoint which stores "who did this" or "who owns this" has to choose the accountable human
        deliberately, and only some do today. What is guaranteed:
    </p>

    <ul>
        <li><strong>Entitlement grants.</strong> A grant aimed at a consent user is redirected to the human who granted the consent, or rejected outright by the newer endpoints. The consent user can never accumulate roles.</li>
        <li><strong>Bank creation.</strong> The automatic <code>CanCreateEntitlementAtOneBank</code> grant goes to you.</li>
        <li><strong>Account creation on v7.</strong> The holder defaults to you, and naming the consent user explicitly is rejected.</li>
        <li><strong>Account applications on v3.1.</strong> The applicant is you, and the holder on approval is the applicant.</li>
        <li><strong>Dynamic entity roles.</strong> The automatic grants on creating a dynamic entity go to you.</li>
    </ul>

    <p>
        Anything else that records a user, such as older account-creation endpoints, customer links,
        auth contexts or the creator of a transaction request, may still name the consent user. Prefer
        the newest API version for actions that create durable objects, check the owner or holder in
        the response, and treat a consent user id where a human was expected as a bug to report.
    </p>

    <h3>Identity Under a Consent</h3>

    <p>
        Calling <code>GET /users/current</code> with a consent JWT returns the consent user, with the
        accountable human under <code>on_behalf_of</code>. Anything that needs a human user id, such as
        granting a role or naming an account holder, must use that nested id. Passing the consent user's id
        is rejected with a clear error.
    </p>

    <CodeBlock
        code={`GET https://YOUR_OBP_HOST/obp/v7.0.0/users/current
Consent-JWT: <the consent JWT>

{
  "user_id": "<consent user id>",
  "entitlements": { "list": [ { "role_name": "CanCreateAccount", "bank_id": "bank-a" } ] },
  "on_behalf_of": {
    "user_id": "<your user id>",
    ...
  }
}`}
        apiHost={ctx.apiHost}
    />

    <h3>Worked Example: Create a Bank, Then an Account</h3>

    <ol>
        <li>"Create a bank called <code>friday.bank</code>." Opey needs <code>CanCreateBank</code>. You grant a consent carrying it. The bank is created and OBP grants <em>you</em> <code>CanCreateEntitlementAtOneBank</code> at <code>friday.bank</code>. The chat shows a "you gained a new entitlement" notice.</li>
        <li>"Now create an account there." Opey needs <code>CanCreateAccount</code> at <code>friday.bank</code>, which you do not hold. The consent card refuses and says you can grant it to yourself.</li>
        <li>Opey offers to grant it. You approve a consent carrying <code>CanCreateEntitlementAtOneBank</code> at <code>friday.bank</code>. The role lands on you.</li>
        <li>Opey retries the account creation. A fresh consent now carries <code>CanCreateAccount</code> at <code>friday.bank</code>, and the v7 endpoint creates the account with you as holder.</li>
    </ol>

    <p>
        Two consents were minted for the escalation and one more for the account. Each is visible on
        <a href="/user/consents">My Consents</a> and traceable on the
        <a href="/user/my-activity-dashboard">Activity Dashboard</a> by reference id.
    </p>

    <h3>Quick Reference</h3>

    <table>
        <thead>
            <tr>
                <th>You want Opey to…</th>
                <th>You need</th>
                <th>Possible?</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>List banks, read glossary or resource docs</td>
                <td>Nothing. Public endpoints need no consent.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>Create a bank</td>
                <td><code>CanCreateBank</code></td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>Open an account at a bank</td>
                <td><code>CanCreateAccount</code> at that bank</td>
                <td>Yes. On the v7 endpoint you become the holder.</td>
            </tr>
            <tr>
                <td>Read balances or transactions</td>
                <td>A view on that account, picked in Working accounts</td>
                <td>Yes, for picked accounts only</td>
            </tr>
            <tr>
                <td>Grant a role to a user at one bank</td>
                <td><code>CanCreateEntitlementAtOneBank</code> at that bank</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>Grant a role at any bank</td>
                <td><code>CanCreateEntitlementAtAnyBank</code></td>
                <td>No. Never allowed in a consent. Grant yourself the one-bank role first.</td>
            </tr>
            <tr>
                <td>Use a role you were given a minute ago</td>
                <td>A fresh consent</td>
                <td>Yes, after you retry and grant again</td>
            </tr>
            <tr>
                <td>Act with your super admin powers</td>
                <td>A stored entitlement for the role</td>
                <td>No. Virtual roles cannot be embedded.</td>
            </tr>
        </tbody>
    </table>

    <h3>Related</h3>

    <ul>
        <li><a href="/developers/opey">Opey</a> &mdash; what the assistant is and how to talk to it</li>
        <li><a href="/developers/consents">Consents</a> &mdash; the consent model in full</li>
        <li><a href="/developers/account-access">Account Access</a> &mdash; how Views control data access</li>
        <li><a href="/developers/agents-and-mcp">Agents and MCP</a> &mdash; connect your own agents the same way</li>
        <li><a href="/user/entitlements">My Entitlements</a> &mdash; see and grant your roles</li>
        <li><a href="/user/consents">My Consents</a> &mdash; the consents Opey has been given</li>
        {#if ctx.apiExplorerUrl}
            <li><a href="{ctx.apiExplorerUrl}/resource-docs?tags=Consent" target="_blank" rel="noopener noreferrer">Consent endpoints</a> in the API Explorer</li>
        {/if}
    </ul>
</div>
