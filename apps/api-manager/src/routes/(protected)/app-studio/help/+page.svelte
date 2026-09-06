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
  import { LIVE_TAGS, BEHAVIOURS } from "@obp/shared/landing";
  import { CircleHelp, CircleCheck, CircleAlert, CircleX, ExternalLink, Search } from "@lucide/svelte";

  let { data } = $props();

  // ---- Scope check per consumer (through the existing OBP proxy) ----
  type ScopeCheck = { state: "checking" | "granted" | "missing" | "error"; message?: string };
  let scopeChecks = $state<Record<string, ScopeCheck>>({});
  let consumerFilter = $state("");

  const filteredConsumers = $derived.by(() => {
    const q = consumerFilter.trim().toLowerCase();
    const all = data.consumers;
    const hits = q ? all.filter((c) => `${c.app_name} ${c.developer_email} ${c.consumer_id}`.toLowerCase().includes(q)) : all;
    return hits.slice(0, 25);
  });

  async function checkScope(consumerId: string) {
    scopeChecks = { ...scopeChecks, [consumerId]: { state: "checking" } };
    try {
      const response = await fetch(`/proxy/obp/v6.0.0/consumers/${encodeURIComponent(consumerId)}/scopes`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
      const has = (body?.list ?? []).some((s: any) => s.role_name === data.getRole);
      scopeChecks = { ...scopeChecks, [consumerId]: { state: has ? "granted" : "missing" } };
    } catch (e) {
      scopeChecks = { ...scopeChecks, [consumerId]: { state: "error", message: e instanceof Error ? e.message : String(e) } };
    }
  }

  const entityOk = $derived(data.entity.exists);
  const authModeOk = $derived(data.entity.exists && data.entity.auth_mode === data.requiredAuthMode);
</script>

<svelte:head>
  <title>App Studio Help - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <div class="mb-6">
    <a href="/app-studio" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to App Studio</a>
    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
      <CircleHelp class="h-7 w-7" />
      App Studio Help
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Setup for this OBP instance, then how App Studio is used.
    </p>
  </div>

  {#if data.warnings.length > 0}
    <div class="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200" data-testid="help-warnings">
      <ul class="list-disc space-y-1 pl-5">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
    </div>
  {/if}

  <nav class="mb-8 flex gap-4 text-sm">
    <a href="#setup" class="underline">Setup</a>
    <a href="#usage" class="underline">Usage</a>
  </nav>

  <!-- ============================ SETUP ============================ -->
  <section id="setup" class="mb-12">
    <h2 class="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Setup</h2>
    <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
      Pages and apps written in App Studio are stored in OBP as records of the system-level dynamic entity
      <code>{data.entityName}</code>. The Portal reads the published ones as an application, with its own consumer.
      Three things have to be in place.
    </p>

    <!-- Step 1: OBP-API supports auth_mode -->
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" data-testid="help-step-obp" data-state={data.entity.obp_supports_auth_mode ? "ok" : "missing"}>
      <div class="flex items-start gap-3">
        {#if data.entity.obp_supports_auth_mode}<CircleCheck class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />{:else}<CircleAlert class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />{/if}
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">1. OBP-API with dynamic entity auth modes</h3>
          <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {#if data.entity.obp_supports_auth_mode}
              This OBP-API returns <code>auth_mode</code> on dynamic entity definitions, so a consumer's Scope can grant access to an entity's data endpoints.
            {:else}
              This OBP-API does not return <code>auth_mode</code> on dynamic entity definitions. Its data endpoints only check the calling user's Entitlements, so step 3 must use the fallback described there until OBP-API is upgraded.
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- Step 2: the entity -->
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" data-testid="help-step-entity" data-state={authModeOk ? "ok" : entityOk ? "auth-mode" : "missing"}>
      <div class="flex items-start gap-3">
        {#if authModeOk}<CircleCheck class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />{:else if entityOk}<CircleAlert class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />{:else}<CircleX class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />{/if}
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">2. The <code>{data.entityName}</code> dynamic entity</h3>
          {#if data.entity.exists}
            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Exists, id <code>{data.entity.dynamic_entity_id}</code>{#if data.entity.record_count !== null}, {data.entity.record_count} record{data.entity.record_count === 1 ? "" : "s"}{/if}.
              Auth mode is <code>{data.entity.auth_mode}</code>{#if !authModeOk}, but the Portal needs <code>{data.requiredAuthMode}</code>. The API Manager updates it at its next start if its consumer may edit entities; otherwise edit the entity and set it{/if}.
            </p>
            <a href="/dynamic-entities/system/{data.entity.dynamic_entity_id}" class="mt-2 inline-block text-sm underline">Open the entity</a>
          {:else}
            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Not found. The API Manager creates it at startup when its own consumer holds <code>CanCreateSystemLevelDynamicEntity</code>.
              Otherwise create it from the template, which prefills every field including the auth mode:
            </p>
            <a href="/dynamic-entities/system/create?template=obp-portal-page" class="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-testid="help-create-entity">
              Create {data.entityName} from the template
            </a>
          {/if}
          <details class="mt-3 text-sm">
            <summary class="cursor-pointer text-gray-600 dark:text-gray-400">Fields</summary>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              <li><code>slug</code>, <code>title</code>, <code>kind</code> (page or app), <code>status</code> (draft or published), <code>summary</code>, <code>source</code>, <code>author</code>, <code>updated_at</code>.</li>
              <li>Not personal, not public, not community: drafts must never be readable by anyone but the editors and the Portal.</li>
              <li>Auth mode <code>{data.requiredAuthMode}</code>: editors use their Entitlements, the Portal uses its consumer's Scope.</li>
            </ul>
          </details>
        </div>
      </div>
    </div>

    <!-- Step 3: the Portal's consumer -->
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" data-testid="help-step-scope">
      <div class="flex items-start gap-3">
        <Search class="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">3. Let the Portal read published pages</h3>
          <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
            The Portal calls OBP with its own OAuth client (client credentials). Its consumer needs exactly one Scope, the Get role of the entity, and nothing else:
          </p>
          <pre class="mt-2 rounded-md bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100" data-testid="help-get-role">{data.getRole}</pre>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Find the Portal's consumer below (its key is the Portal's OAuth client id), open it, and add that role under <em>Consumer Scopes</em> with an empty bank id.
            Adding a scope needs <code>CanCreateScopeAtOneBank</code>.
            For the FAQ's "Start a chat" button, which links a new group chat to a question, the same consumer also needs <code>CanUpdateDynamicEntity_Systemobp_developer_faq</code>.
          </p>

          <div class="mt-3">
            <input type="search" name="consumer_filter" placeholder="Filter consumers by name, email or id" class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={consumerFilter} data-testid="help-consumer-filter" />
            <ul class="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700" data-testid="help-consumers">
              {#each filteredConsumers as c (c.consumer_id)}
                {@const check = scopeChecks[c.consumer_id]}
                <li class="flex flex-wrap items-center gap-3 px-3 py-2 text-sm" data-testid="help-consumer-row" data-state={check?.state ?? "unchecked"}>
                  <div class="min-w-0 flex-1">
                    <span class="font-medium text-gray-900 dark:text-gray-100">{c.app_name}</span>{#if !c.enabled}<span class="ml-2 text-xs text-red-600">disabled</span>{/if}
                    <div class="truncate text-xs text-gray-500 dark:text-gray-400">{c.developer_email} · <code>{c.consumer_id}</code></div>
                  </div>
                  {#if check?.state === "granted"}
                    <span class="inline-flex items-center gap-1 text-green-700 dark:text-green-300"><CircleCheck class="h-4 w-4" /> has the scope</span>
                  {:else if check?.state === "missing"}
                    <span class="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-300"><CircleAlert class="h-4 w-4" /> no scope yet</span>
                  {:else if check?.state === "error"}
                    <span class="text-red-700 dark:text-red-300">{check.message}</span>
                  {:else if check?.state === "checking"}
                    <span class="text-gray-500">checking…</span>
                  {/if}
                  <button type="button" class="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700" onclick={() => checkScope(c.consumer_id)} data-testid="help-check-scope">Check</button>
                  <a href="/consumers/{c.consumer_id}/edit" class="inline-flex items-center gap-1 text-xs underline">Open <ExternalLink class="h-3 w-3" /></a>
                </li>
              {/each}
              {#if filteredConsumers.length === 0}<li class="px-3 py-2 text-sm text-gray-500">No consumers match.</li>{/if}
              {#if data.consumers.length > 25 && filteredConsumers.length === 25}<li class="px-3 py-2 text-xs text-gray-500">Showing the first 25; filter to find others.</li>{/if}
            </ul>
          </div>

          <details class="mt-3 text-sm">
            <summary class="cursor-pointer text-gray-600 dark:text-gray-400">Fallback for an OBP-API without auth modes</summary>
            <p class="mt-2 text-gray-700 dark:text-gray-300">
              Older OBP-API checks only the calling user's Entitlements on entity data endpoints. A client-credentials token still resolves to a user: OBP creates a resource user for the client's service account the first time the Portal calls it, named after the token subject (a UUID).
              After the Portal's first call, find that user on the <a href="/users" class="underline">Users</a> page and grant it the Entitlement <code>{data.getRole}</code>. Remove it again once OBP-API is upgraded and the Scope is in place.
            </p>
          </details>
        </div>
      </div>
    </div>

    <!-- Editors -->
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" data-testid="help-step-editors">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">4. Who may save and publish</h3>
      <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
        Saving in App Studio writes <code>{data.entityName}</code> records with the editor's own login, so an editor (marketing, for example) needs these Entitlements and no other administrative role:
      </p>
      <ul class="mt-2 space-y-1 font-mono text-sm text-gray-900 dark:text-gray-100">
        {#each data.editorRoles as r}<li>{r}</li>{/each}
        <li>{data.getRole}</li>
      </ul>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">Grant them on the <a href="/users" class="underline">Users</a> page, or ask Opey.</p>
    </div>

    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
      Published records are served by the Portal{#if data.portalUrl} at <code>{data.portalUrl}/pages/SLUG</code>, listed at <a href="{data.portalUrl}/pages" class="underline">{data.portalUrl}/pages</a>{:else} at <code>/pages/SLUG</code>{/if}. Pages are sanitised and rendered inline with live catalogue data; Apps run in a sandboxed frame and reach OBP through the Portal, anonymously for visitors who are not signed in. The Portal reads the entity with its own application token, so step 3 above must be done first.
    </div>
  </section>

  <!-- ============================ USAGE ============================ -->
  <section id="usage">
    <h2 class="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Usage</h2>
    <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
      Open <a href="/app-studio" class="underline">App Studio</a>, describe what you want to Opey on the right, and review the preview. Every change Opey makes can be kept or reverted.
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">App: runs code, sealed off</h3>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>A self-contained web app with JavaScript, shown in a phone frame or at page width.</li>
          <li>It runs in a sandboxed iframe with no session and no access to the page around it. It calls OBP with <code>obp.get('/obp/v6.0.0/…')</code>, <code>obp.post</code>, <code>obp.put</code>, <code>obp.delete</code>; the API Manager makes the real call. Reads run unattended, writes ask you first.</li>
          <li><strong>Access</strong> chooses whose credentials those calls use: your session, or a consent you create for one of your consumers, limited to chosen accounts and roles. OBP sends a code to confirm the consent.</li>
          <li><code>obp.navigate(url)</code> asks the hosting page to navigate, for sign-in links. Console output and API calls appear under the editor and are shown to Opey.</li>
        </ul>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">Page: no code, lives in the Portal</h3>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Free HTML and CSS. Scripts are removed, so the page can be rendered inside the Portal as a first-class page.</li>
          <li>Live catalogue data comes from tags the server fills in; interaction comes from behaviours declared with <code>data-behaviour</code>. See the <a href="/app-studio/blocks" class="underline">Page Blocks</a> demo and tick "Outline the blocks".</li>
          <li>Preview at page width or phone width; Opey is told which one you are looking at.</li>
        </ul>
        <details class="mt-3 text-sm">
          <summary class="cursor-pointer text-gray-600 dark:text-gray-400">Tags and behaviours</summary>
          <ul class="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
            {#each LIVE_TAGS as t (t.tag)}<li><code>&lt;{t.tag}&gt;</code> {t.description}</li>{/each}
            {#each BEHAVIOURS as b (b.name)}<li><code>data-behaviour="{b.name}"</code> {b.description}</li>{/each}
          </ul>
        </details>
      </div>
    </div>

    <div class="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">Saving and publishing</h3>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
        <li><strong>Save draft</strong> stores the current source under a slug. <strong>Publish to Portal</strong> stores it with status published; <strong>Unpublish</strong> returns it to draft. <strong>Delete</strong> removes the record.</li>
        <li><strong>Open saved…</strong> loads any saved page or app back into the studio in its mode. <strong>Start a new one</strong> detaches the editor from the record so the next save creates a new one.</li>
        <li>Copy and Download give you the raw source at any time.</li>
      </ul>
    </div>

    <div class="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">Working with Opey</h3>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
        <li>Opey fills the editor through the same form-fill tool as the other pages. It always sends the complete source, so ask for changes in plain words: "make the hero green", "add a transactions screen".</li>
        <li>Opey sees the current source, the preview width, the last API calls and console errors in App mode, and any block errors in Page mode, so it can fix what it broke.</li>
        <li>After each fill a banner offers Keep or Revert. Revert restores what you had before Opey touched it.</li>
      </ul>
    </div>
  </section>
</div>
