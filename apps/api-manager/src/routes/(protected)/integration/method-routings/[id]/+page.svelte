<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { Wand2, HelpCircle, Trash2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import MethodRoutingForm from "$lib/components/MethodRoutingForm.svelte";
  import {
    fetchMethodNames, fetchConnectorNames, fetchBankIds, fetchMethodRoutings, saveMethodRouting, deleteMethodRouting, routingToFormValues,
    type MethodRoutingFormValues,
  } from "$lib/services/methodRoutings";

  let { data } = $props();

  let methodNames = $state<string[]>([]);
  let connectorNames = $state<string[]>([]);
  let bankIds = $state<string[]>([]);
  let listsLoading = $state(true);
  let initial = $state<MethodRoutingFormValues | undefined>(undefined);
  let loadError = $state("");
  let deleting = $state(false);

  onMount(async () => {
    const [names, connectors, banks] = await Promise.all([
      fetchMethodNames().catch(() => []),
      fetchConnectorNames().catch(() => []),
      fetchBankIds().catch(() => []),
    ]);
    methodNames = names; connectorNames = connectors; bankIds = banks;
    listsLoading = false;
    try {
      const routings = await fetchMethodRoutings(false);
      const routing = routings.find((r) => r.method_routing_id === data.methodRoutingId);
      if (!routing) { loadError = `No configured method routing with id ${data.methodRoutingId}.`; return; }
      initial = routingToFormValues(routing, true);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  });

  async function handleSubmit(values: MethodRoutingFormValues) {
    await saveMethodRouting({ ...values, method_routing_id: data.methodRoutingId });
    await goto("/integration/method-routings?saved=" + encodeURIComponent(values.method_name));
  }

  async function handleDelete() {
    deleting = true;
    try {
      await deleteMethodRouting(data.methodRoutingId);
      await goto("/integration/method-routings?deleted=" + encodeURIComponent(initial?.method_name ?? data.methodRoutingId));
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Change this routing to apply to all banks with a regex pattern instead of one bank.", pillTitle: "All banks", icon: Wand2 },
    { questionString: "Explain what this routing does in plain words.", pillTitle: "Explain this routing", icon: HelpCircle },
  ];
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage: "I can change this routing for you, or explain what it does. Tell me what should be different.",
  };
</script>

<svelte:head>
  <title>Edit Method Routing - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <a href="/integration/method-routings" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Method Routings</a>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Method Routing</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">{initial ? `${initial.method_name} → ${initial.connector_name}` : ""} <code class="text-xs">{data.methodRoutingId}</code></p>
    </div>
    {#if initial}
      <button type="button" class="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" disabled={deleting} onclick={handleDelete} data-testid="method-routing-delete">
        <Trash2 class="h-4 w-4" /> {deleting ? "Deleting…" : "Delete routing"}
      </button>
    {/if}
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#if loadError}<p class="mb-4 text-sm text-red-700 dark:text-red-300">{loadError}</p>{/if}
      {#if initial}
        <MethodRoutingForm {initial} {methodNames} {connectorNames} {bankIds} {listsLoading} submitLabel="Save changes" cancelHref="/integration/method-routings" onSubmit={handleSubmit} />
      {:else if !loadError}
        <p class="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      {/if}
    </div>
    <aside class="lg:sticky lg:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-8rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
