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
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat, ResizableSplit } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import { Send, Trash2, RefreshCw, RotateCcw, Wand2, HelpCircle, Stethoscope, CircleHelp } from "@lucide/svelte";
  import DynamicEntityWebhookForm from "$lib/components/DynamicEntityWebhookForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import {
    updateWebhook,
    deleteWebhook,
    testWebhook,
    retryDelivery,
    webhookPageHref,
    DEACTIVATED_REASONS,
    WEBHOOK_ROLES,
    type WebhookFormValues,
  } from "$lib/services/dynamicEntityWebhooks";

  let { data } = $props();
  const w = $derived(data.webhook);
  const listHref = $derived(`/dynamic-entity-webhooks?bank_id=${encodeURIComponent(w.bank_id)}`);

  let message = $state<string | null>(data.created ? "Created. Send a test request to check that the receiver gets it." : null);
  let actionError = $state<string | null>(null);
  let busy = $state<string | null>(null);

  async function run(label: string, action: () => Promise<string | void>) {
    busy = label;
    actionError = null;
    message = null;
    try {
      const done = await action();
      if (done) message = done;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  async function handleSubmit(values: WebhookFormValues) {
    await updateWebhook(w.bank_id, w.dynamic_entity_id, w.webhook_id, values);
    message = "Saved.";
    await invalidateAll();
  }

  function sendTest() {
    return run("test", async () => {
      const queued = await testWebhook(w.bank_id, w.dynamic_entity_id, w.webhook_id);
      return `Queued test request ${queued.event_id}. It is sent within moments; refresh the deliveries below to see how it went.`;
    });
  }

  function retry(eventId: string) {
    return run(`retry-${eventId}`, async () => {
      await retryDelivery(w.bank_id, w.dynamic_entity_id, w.webhook_id, eventId);
      return `Delivery ${eventId} is queued again.`;
    });
  }

  async function handleDelete() {
    if (!confirm(`Delete the webhook of ${w.entity_name} to ${w.url}? Requests not yet delivered are dropped.`)) return;
    busy = "delete";
    actionError = null;
    try {
      await deleteWebhook(w.bank_id, w.dynamic_entity_id, w.webhook_id);
      await goto(listHref);
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  function chooseStatus(event: Event) {
    const status = (event.currentTarget as HTMLSelectElement).value;
    goto(`${webhookPageHref(w)}${status ? `?status=${status}` : ""}`, { noScroll: true });
  }

  const statusClass: Record<string, string> = {
    DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    STICKY: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Look at this webhook's recent deliveries and tell me whether the receiver is getting them, and what to do about any that failed.", pillTitle: "Check deliveries", icon: Stethoscope },
    { questionString: "Change this webhook so it only sends updates when a field I care about changes. Look at the entity's fields and ask me which.", pillTitle: "Narrow with conditions", icon: Wand2 },
    { questionString: "How does my receiver verify the OBP-Signature header and drop duplicate requests?", pillTitle: "Verify and deduplicate", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "I can change this webhook's URL, events, field conditions or description for you, or help read its deliveries. Nothing is saved until you press Save changes.";

  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  // The form, plus the deliveries on screen, so Opey can read how sending has gone.
  const clientContext = () => {
    const shown = data.deliveries.slice(0, 20).map((d) =>
      `  ${d.created_at} ${d.event_name}${d.record_id ? ` record ${d.record_id}` : ""}: ${d.status}, ${d.attempts} attempt(s)` +
      `${d.last_http_status ? `, last HTTP ${d.last_http_status}` : ""}${d.last_error ? `, last error: ${d.last_error}` : ""}`);
    return [
      formBridge.describe(),
      `Webhook state: ${w.is_active ? "active" : `off (${w.deactivated_reason ?? "TURNED_OFF"})`}; requests ${w.signature_status === "signed" ? "are signed" : "are not signed on this instance"}.`,
      shown.length > 0 ? `Most recent deliveries${data.status ? ` with status ${data.status}` : ""}, newest first (PENDING is still being retried, STICKY means OBP stopped trying):\n${shown.join("\n")}` : "No deliveries are shown.",
    ].join("\n");
  };
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage: INITIAL_MESSAGE,
  };
</script>

<svelte:head>
  <title>Dynamic Entity Webhook - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <a href={listHref} class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Dynamic Entity Webhooks</a>
      <h1 class="break-all font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">{w.url}</h1>
      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="webhook-details">
        <dt class="text-gray-500 dark:text-gray-400">Entity</dt>
        <dd class="font-mono text-xs text-gray-900 dark:text-gray-100">
          <a href="/dynamic-entities/system/{encodeURIComponent(w.dynamic_entity_id)}?bank_id={encodeURIComponent(w.bank_id)}" class="text-blue-600 hover:underline dark:text-blue-400">{w.entity_name}</a>
        </dd>
        <dt class="text-gray-500 dark:text-gray-400">Space</dt>
        <dd class="font-mono text-xs text-gray-900 dark:text-gray-100">{w.bank_id}</dd>
        <dt class="text-gray-500 dark:text-gray-400">webhook_id</dt>
        <dd class="font-mono text-xs text-gray-900 dark:text-gray-100">{w.webhook_id}</dd>
        <dt class="text-gray-500 dark:text-gray-400">Signing</dt>
        <dd class="text-xs text-gray-900 dark:text-gray-100">
          {#if w.signature_status === "signed"}
            Signed: each request carries OBP-Signature, verifiable with the key at /obp/v3.1.0/certs.
          {:else}
            Not signed on this instance (it has no stable server key). Requests carry OBP-Signature-Status: not_configured.
          {/if}
        </dd>
        <dt class="text-gray-500 dark:text-gray-400">Created</dt>
        <dd class="text-xs text-gray-900 dark:text-gray-100">{w.created_at} by <a href="/users/{encodeURIComponent(w.created_by_user_id)}" class="font-mono text-blue-600 hover:underline dark:text-blue-400">{w.created_by_user_id}</a></dd>
        <dt class="text-gray-500 dark:text-gray-400">Updated</dt>
        <dd class="text-xs text-gray-900 dark:text-gray-100">{w.updated_at}</dd>
      </dl>
      <div class="mt-3"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
    </div>
    <div class="flex items-center gap-2">
<a href="/dynamic-entity-webhooks/help" aria-label="Dynamic Entity Webhooks help" data-testid="webhooks-help-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        <CircleHelp size={16} />
      </a>
      <button type="button" onclick={sendTest} disabled={busy !== null} data-testid="test-btn" class="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-900/20">
        <Send size={14} /> {busy === "test" ? "Queuing…" : "Send test request"}
      </button>
      <button type="button" onclick={handleDelete} disabled={busy !== null} data-testid="delete-btn" class="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">
        <Trash2 size={14} /> {busy === "delete" ? "Deleting…" : "Delete"}
      </button>
    </div>
  </div>

  <SpaceRoleAlerts bankId={w.bank_id} roles={[
    { role: WEBHOOK_ROLES.get, purpose: "to see this webhook and its deliveries" },
    { role: WEBHOOK_ROLES.update, purpose: "to change it, send a test request or retry a delivery" },
    { role: WEBHOOK_ROLES.delete, purpose: "to delete it" },
  ]} />

  {#if !w.is_active}
    <div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200" data-testid="deactivated">
      <strong>Off ({w.deactivated_reason ?? "TURNED_OFF"}).</strong> {DEACTIVATED_REASONS[w.deactivated_reason ?? "TURNED_OFF"] ?? ""}
    </div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="message">{message}</div>
  {/if}

  <ResizableSplit breakpoint="lg">
    {#snippet main()}
    <div class="space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
      {#key `${w.webhook_id}-${w.updated_at}`}
        <DynamicEntityWebhookForm
          entity={data.entity}
          initial={{ url: w.url, events: w.events, field_conditions: w.field_conditions, is_active: w.is_active, description: w.description }}
          submitLabel="Save changes"
          cancelHref={listHref}
          onSubmit={handleSubmit}
        />
      {/key}
    </div>

    <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Deliveries</h2>
        <div class="flex items-center gap-2">
          <select value={data.status} onchange={chooseStatus} class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="status-filter">
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="STICKY">STICKY</option>
          </select>
          <button type="button" onclick={() => invalidateAll()} class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="refresh-deliveries">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>
      {#if data.deliveriesError}
        <div class="p-4 text-sm text-red-700 dark:text-red-300" data-testid="deliveries-error">{data.deliveriesError}</div>
      {:else if data.deliveries.length === 0}
        <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="no-deliveries">No deliveries{data.status ? ` with status ${data.status}` : ""} yet.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="deliveries-table">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Event</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Attempts</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each data.deliveries as d (d.event_id)}
                <tr data-testid="delivery-{d.event_id}">
                  <td class="px-3 py-2 text-xs">
                    <div class="font-mono text-gray-900 dark:text-gray-100">{d.event_name}</div>
                    {#if d.record_id}<div class="font-mono text-gray-500 dark:text-gray-400">record {d.record_id}</div>{/if}
                    <div class="text-gray-500 dark:text-gray-400">{d.created_at}</div>
                  </td>
                  <td class="px-3 py-2 text-xs">
                    <span class="rounded-full px-2 py-0.5 {statusClass[d.status] ?? ''}">{d.status}</span>
                    {#if d.last_http_status}<div class="mt-1 text-gray-500 dark:text-gray-400">HTTP {d.last_http_status}</div>{/if}
                    {#if d.last_error}<div class="mt-1 max-w-xs break-words text-gray-500 dark:text-gray-400">{d.last_error}</div>{/if}
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{d.attempts}</td>
                  <td class="px-3 py-2 text-right">
                    {#if d.status === "STICKY"}
                      <button type="button" onclick={() => retry(d.event_id)} disabled={busy !== null} class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="retry-{d.event_id}">
                        <RotateCcw size={12} /> {busy === `retry-${d.event_id}` ? "Queuing…" : "Retry"}
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">The 50 most recent{data.status ? ` ${data.status}` : ""} deliveries, newest first.</div>
      {/if}
    </div>
    </div>
    {/snippet}

    {#snippet side()}
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    {/snippet}
  </ResizableSplit>
</div>
