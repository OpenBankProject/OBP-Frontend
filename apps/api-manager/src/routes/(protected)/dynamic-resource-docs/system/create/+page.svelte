<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { FilePlus2, Wand2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import DynamicResourceDocForm, {
    type DynamicResourceDocFormValues,
  } from "$lib/components/DynamicResourceDocForm.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  async function handleSubmit(values: DynamicResourceDocFormValues) {
    const response = await fetch(
      `/proxy/obp/v4.0.0/management/dynamic-resource-docs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      },
    );
    if (!response.ok) {
      const errorDetails = await extractErrorFromResponse(
        response,
        "Failed to create dynamic resource doc",
      );
      logErrorDetails("Create Dynamic Resource Doc", errorDetails);
      throw new Error(formatErrorForDisplay(errorDetails));
    }
    const created = await response.json();
    const id = created?.dynamic_resource_doc_id;
    if (id) {
      await goto(`/dynamic-resource-docs/system/${id}`);
    } else {
      await goto("/dynamic-resource-docs/system");
    }
  }

  // ---- Opey side panel ------------------------------------------------------
  // Opey can draft the form via the client-executed set_form_fields tool:
  // the form registers itself on formBridge, this handler applies the draft,
  // and the result (applied/ignored field names) goes back to the graph.
  const clientTools = {
    set_form_fields: async (toolInput: Record<string, any>) =>
      formBridge.apply(toolInput?.fields ?? {}),
  };

  // Live page context, rebuilt per message so Opey always sees current values.
  const clientContext = () => formBridge.describe();

  const suggestedQuestions: SuggestedQuestion[] = [
    {
      questionString:
        "Draft this form for a GET endpoint that returns a bank's branches including opening hours.",
      pillTitle: "Draft a GET endpoint",
      icon: Wand2,
    },
    {
      questionString:
        "Fill in a Scala method_body for the current verb and URL, with sensible error handling.",
      pillTitle: "Write the Scala body",
      icon: FilePlus2,
    },
  ];

  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: '/metrics',
    initialAssistantMessage:
      "I can draft this Resource Doc for you — tell me what the endpoint should do and I'll fill in the fields, including the Scala method body. You review every value before creating it.",
  };
</script>

<svelte:head>
  <title>Create System Dynamic Resource Doc - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a
      href="/dynamic-resource-docs/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to System Dynamic Resource Docs
    </a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Create System Dynamic Resource Doc
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Define a new endpoint by writing the Scala method body that handles it.
    </p>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <DynamicResourceDocForm onSubmit={handleSubmit} submitLabel="Create Resource Doc">
        {#snippet cancel()}
          <a
            href="/dynamic-resource-docs/system"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </a>
        {/snippet}
      </DynamicResourceDocForm>
    </div>

    <!-- Opey pane: OpeyChat requires a definite height all the way down -->
    <aside class="lg:sticky lg:top-4" data-testid="opey-form-pane">
      <div
        class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-8rem)] dark:border-gray-700"
      >
        <OpeyChat
          {opeyChatOptions}
          userAuthenticated={!!page.data.userId}
          {clientTools}
          {clientContext}
        />
      </div>
    </aside>
  </div>
</div>
