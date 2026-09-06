<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { FilePlus2, Wand2, ShieldCheck, ShieldAlert, CircleHelp, Copy, Check } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import DynamicResourceDocForm, {
    type DynamicResourceDocFormValues,
  } from "$lib/components/DynamicResourceDocForm.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data } = $props();
  const approval = data.approval;

  // Set when OBP answered 202: the doc was not created, a Dynamic Change Request was.
  let pendingRequest = $state<{
    dynamic_change_request_id: string;
    payload_hash: string;
    expires_at: string;
    request_verb: string;
    request_path: string;
  } | null>(null);
  let copiedId = $state(false);

  async function copyRequestId() {
    if (!pendingRequest) return;
    try {
      await navigator.clipboard.writeText(pendingRequest.dynamic_change_request_id);
      copiedId = true;
      setTimeout(() => (copiedId = false), 1500);
    } catch {
      /* clipboard unavailable: the id is plain selectable text anyway */
    }
  }

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
    if (response.status === 202 && created?.dynamic_change_request_id) {
      // Maker/checker is on: nothing is live until a different user approves this request.
      pendingRequest = created;
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
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

  {#if pendingRequest}
    <div
      class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
      role="status"
      data-testid="approval-pending-panel"
    >
      <div class="flex items-start gap-3">
        <ShieldCheck size={20} class="mt-0.5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">Submitted for approval. The endpoint is not live yet.</p>
          <p class="mt-1">
            OBP stored your definition as a Dynamic Change Request. A different user holding
            <code class="rounded bg-amber-100 px-1 dark:bg-amber-900/40">{approval.approvalRole}</code>
            must approve it before it is compiled and served. The request expires
            {#if pendingRequest.expires_at}at {pendingRequest.expires_at}{:else}after {approval.requestTtlHours} hours{/if}.
          </p>
          <dl class="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt class="font-medium">Change request id</dt>
            <dd class="flex items-center gap-2 font-mono text-xs break-all">
              <span data-testid="pending-change-request-id">{pendingRequest.dynamic_change_request_id}</span>
              <button
                type="button"
                class="inline-flex items-center rounded border border-amber-300 px-1.5 py-0.5 text-[11px] hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
                onclick={copyRequestId}
                aria-label="Copy change request id"
              >
                {#if copiedId}<Check size={12} />{:else}<Copy size={12} />{/if}
              </button>
            </dd>
            <dt class="font-medium">Payload hash</dt>
            <dd class="font-mono text-xs break-all">{pendingRequest.payload_hash}</dd>
            <dt class="font-medium">Will apply as</dt>
            <dd class="font-mono text-xs">{pendingRequest.request_verb} {pendingRequest.request_path}</dd>
          </dl>
          <p class="mt-3">
            <a class="underline hover:no-underline" href="/dynamic-resource-docs/help#approval">How approval works</a>
            &middot;
            <a class="underline hover:no-underline" href="/dynamic-resource-docs/system">Back to the list</a>
          </p>
        </div>
      </div>
    </div>
  {:else if approval.known && !approval.executionEnabled}
    <div
      class="mb-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100"
      role="alert"
      data-testid="dynamic-code-disabled-notice"
    >
      <ShieldAlert size={20} class="mt-0.5 shrink-0" />
      <div>
        <p class="font-semibold">Dynamic code execution is disabled on this instance.</p>
        <p class="mt-1">
          Creating this Resource Doc will fail with <code class="rounded bg-red-100 px-1 dark:bg-red-900/40">OBP-50020</code>
          because the OBP-API prop
          <code class="rounded bg-red-100 px-1 dark:bg-red-900/40">allow_user_generated_scala_code</code>
          is not <code class="rounded bg-red-100 px-1 dark:bg-red-900/40">true</code>. An operator sets it in the
          props file or as the environment variable
          <code class="rounded bg-red-100 px-1 dark:bg-red-900/40">OBP_ALLOW_USER_GENERATED_SCALA_CODE</code>
          and restarts OBP-API; props are read once at startup.
          {#if approval.requiresApproval}Once enabled, maker/checker approval also applies here.{/if}
        </p>
        <a class="mt-2 inline-flex items-center gap-1 underline hover:no-underline" href="/dynamic-resource-docs/help#kill-switch">
          <CircleHelp size={14} /> About this setting
        </a>
      </div>
    </div>
  {:else if approval.requiresApproval}
    <div
      class="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
      data-testid="approval-required-notice"
    >
      <ShieldCheck size={20} class="mt-0.5 shrink-0" />
      <div>
        <p class="font-semibold">Approval is required on this instance.</p>
        <p class="mt-1">
          Creating this Resource Doc submits a Dynamic Change Request instead of publishing the endpoint. A
          different user holding
          <code class="rounded bg-amber-100 px-1 dark:bg-amber-900/40">{approval.approvalRole}</code>
          reviews the exact definition and approves it; only then is the Scala compiled and served.
          {#if approval.requestTtlHours > 0}Unapproved requests expire after {approval.requestTtlHours} hours.{/if}
        </p>
        <a class="mt-2 inline-flex items-center gap-1 underline hover:no-underline" href="/dynamic-resource-docs/help#approval">
          <CircleHelp size={14} /> How approval works
        </a>
      </div>
    </div>
  {:else if approval.known}
    <p class="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" data-testid="approval-off-notice">
      <ShieldCheck size={16} class="shrink-0" />
      <span>
        Dynamic code is enabled and approval is not required on this instance: the endpoint goes live as soon as it is created.
        <a class="underline hover:no-underline" href="/dynamic-resource-docs/help#approval">About maker/checker</a>
      </span>
    </p>
  {:else}
    <p class="mb-6 text-sm text-gray-500 dark:text-gray-400" data-testid="approval-unknown-notice">
      Could not read the approval setting from OBP, so this page cannot say whether the endpoint will go live
      immediately or wait for approval.
      <a class="underline hover:no-underline" href="/dynamic-resource-docs/help#approval">About maker/checker</a>
    </p>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <DynamicResourceDocForm
        onSubmit={handleSubmit}
        submitLabel={approval.requiresApproval ? "Submit for Approval" : "Create Resource Doc"}
      >
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
