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
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { Wand2, HelpCircle, Trash2, ExternalLink } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import GlossaryItemForm from "$lib/components/GlossaryItemForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { saveGlossaryItem, deleteGlossaryItem, isUndeclaredShadow, type GlossaryItemFormValues } from "$lib/services/glossaryItems";

  let { data } = $props();
  const title = $derived(data.item.title);
  let deleting = $state(false);
  let actionError = $state<string | null>(null);

  async function handleSubmit(values: GlossaryItemFormValues) {
    await saveGlossaryItem(values, true);
    await goto("/glossary-items?saved=" + encodeURIComponent(values.title));
  }

  async function handleDelete() {
    const consequence = data.item.shadows_static_glossary_item
      ? " The static Glossary Item of the same title will be served again."
      : " It will disappear from the Glossary.";
    if (!confirm(`Delete the Dynamic Glossary Item "${title}"?${consequence}`)) return;
    deleting = true;
    actionError = null;
    try {
      await deleteGlossaryItem(title);
      await goto("/glossary-items");
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  // Optional because GET /glossary-items/TITLE also answers for static Items, which have no
  // timestamps. The load guard redirects those away, so this page only ever sees Dynamic ones.
  function formatDate(value: string | undefined): string {
    if (!value) return "unknown";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Rewrite this description to be clearer and shorter, keeping every fact and every link.", pillTitle: "Tighten the wording", icon: Wand2 },
    { questionString: "Add an example value and a link to the related glossary entries at the end of this description.", pillTitle: "Add an example", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "I can rewrite or extend this entry. Tell me what should be different and I'll put it in the form for you to review.";
  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
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
  <title>Edit Dynamic Glossary Item - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <a href="/glossary-items" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Dynamic Glossary Items</a>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Dynamic Glossary Item</h1>
      <p class="mt-1 font-mono text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Updated {formatDate(data.item.updated_at)}. Glossary item id <span class="font-mono text-xs">{data.item.glossary_item_id}</span>.
        <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" class="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400" data-testid="api-explorer-link">
          View in the Glossary <ExternalLink size={12} />
        </a>
      </p>
      {#if isUndeclaredShadow(data.item)}
        <p class="mt-2 inline-block rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-100" data-testid="undeclared-shadow">
          A static Glossary Item of this title exists, but this item does not declare that it overrides it — so it is displacing shipped text that nobody asked it to. Tick the override box to confirm it, or delete this item to restore the static text.
        </p>
      {:else if data.item.overrides_static_item}
        <p class="mt-2 inline-block rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="overrides-static">
          This entry overrides the static Glossary Item of the same title. Deleting it restores the shipped text.
        </p>
      {/if}
    </div>
    <button type="button" onclick={handleDelete} disabled={deleting} data-testid="delete-btn" class="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">
      <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
    </button>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#key title}
        <GlossaryItemForm
          initial={{ title, description: data.item.description.markdown, overrides_static_item: data.item.overrides_static_item }}
          shadowsStatic={data.item.shadows_static_glossary_item}
          lockTitle={true}
          submitLabel="Save changes"
          cancelHref="/glossary-items"
          onSubmit={handleSubmit}
        />
      {/key}
    </div>
    <aside class="lg:sticky lg:top-8" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
