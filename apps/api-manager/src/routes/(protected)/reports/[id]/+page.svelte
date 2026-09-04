<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { FileSpreadsheet, Wand2, ChartColumn, HelpCircle } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import ReportEditor from "$lib/components/ReportEditor.svelte";
  import { fetchReport, saveReport, deleteReport, duplicateReport, STARTER_DEFINITION, STARTER_PARAMETERS, type ReportFormValues } from "$lib/services/reports";

  let { data } = $props();
  const isNew = $derived(data.reportId === "new");

  let initial = $state<ReportFormValues | null>(null);
  let currentId = $state<string | null>(null);
  let bankIds = $state<string[]>([]);
  let loadError = $state("");
  let saving = $state(false);
  let savedMessage = $state("");

  onMount(async () => {
    fetch("/proxy/obp/v6.0.0/banks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (bankIds = (d?.banks ?? []).map((b: any) => b.bank_id).filter(Boolean).sort()))
      .catch(() => {});
    if (isNew) {
      initial = { slug: "", title: "", description: "", definition: STARTER_DEFINITION, parameters: STARTER_PARAMETERS };
      return;
    }
    try {
      const r = await fetchReport(data.reportId);
      currentId = r.id;
      initial = { slug: r.slug, title: r.title, description: r.description, definition: r.definition, parameters: r.parameters };
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  });

  async function handleSave(values: ReportFormValues) {
    saving = true;
    try {
      const saved = await saveReport(currentId, values);
      savedMessage = `Saved ${saved.slug} at ${saved.updated_at}`;
      if (!currentId) {
        currentId = saved.id;
        await goto(`/reports/${saved.id}`, { replaceState: true });
      }
    } finally {
      saving = false;
    }
  }

  /** Duplicate creates a separate record from what is in the editor now, then opens it. */
  async function handleDuplicate(values: ReportFormValues) {
    const copy = await duplicateReport(values);
    await goto(`/reports/${copy.id}`);
  }

  async function handleDelete() {
    if (!currentId) return;
    await deleteReport(currentId);
    await goto("/reports");
  }

  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Write a report that lists every API product with its bank, category and monthly price, sorted by price.", pillTitle: "Products report", icon: ChartColumn },
    { questionString: "Write a report with a bank_id parameter that lists the customers at that bank with their legal name and email.", pillTitle: "Customers at a bank", icon: Wand2 },
    { questionString: "Explain how a report definition works and what run(params, obp) must return.", pillTitle: "How reports work", icon: HelpCircle },
  ];
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage:
      "Describe the report you need and I'll write the definition and its parameters. Run it to see the rows; I can see the result, the OBP calls and any errors, so tell me what to change.",
  };
</script>

<svelte:head><title>{isNew ? "New Report" : "Report"} - API Manager</title></svelte:head>

<div class="container mx-auto max-w-[110rem] px-4 py-8">
  <div class="mb-6">
    <a href="/reports" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Reports</a>
    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100"><FileSpreadsheet class="h-7 w-7" /> {isNew ? "New Report" : (initial?.title || "Report")}</h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">A definition is JavaScript that calls OBP with your access and returns rows. Runs happen in your browser, in a sandbox.</p>
    {#if savedMessage}<p class="mt-1 text-sm text-emerald-700 dark:text-emerald-300" data-testid="report-saved">{savedMessage}</p>{/if}
  </div>

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div>
      {#if loadError}
        <p class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">{loadError}</p>
      {:else if initial}
        {#key currentId}
          <ReportEditor {initial} {bankIds} {saving} canDelete={!!currentId} onSave={handleSave} onDelete={handleDelete} onDuplicate={handleDuplicate} />
        {/key}
      {:else}
        <p class="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      {/if}
    </div>
    <aside class="xl:sticky xl:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm xl:h-[calc(100vh-8rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
