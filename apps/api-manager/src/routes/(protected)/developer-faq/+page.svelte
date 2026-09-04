<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { CircleHelp, MessagesSquare, Plus, Pencil, Trash2, Wand2, ExternalLink } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";

  interface FaqItem { id: string; question: string; answer: string; opey_prompt: string; category: string; sort_order: number; chat_room_id: string; chat_joining_key: string }

  let items = $state<FaqItem[]>([]);
  let loading = $state(true);
  let error = $state("");
  let notice = $state("");
  const portalUrl = String(page.data.externalLinks?.PORTAL_URL ?? "").replace(/\/$/, "");

  // ---- Form (add or edit one question) ----
  let editingId = $state<string | null>(null);
  let question = $state("");
  let answer = $state("");
  let opeyPrompt = $state("");
  let category = $state("");
  let sortOrder = $state("10");
  let saving = $state(false);
  let formOpen = $state(false);
  const categories = $derived([...new Set(items.map((i) => i.category).filter(Boolean))].sort());

  function startNew() {
    editingId = null; question = ""; answer = ""; opeyPrompt = ""; category = ""; sortOrder = String((Math.max(0, ...items.map((i) => i.sort_order)) || 0) + 10);
    formOpen = true; opeyPrevious = {};
  }
  function startEdit(item: FaqItem) {
    editingId = item.id; question = item.question; answer = item.answer; opeyPrompt = item.opey_prompt; category = item.category; sortOrder = String(item.sort_order);
    formOpen = true; opeyPrevious = {};
  }

  async function api(url: string, init?: RequestInit): Promise<any> {
    const response = await fetch(url, { credentials: "include", ...init });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
    return body;
  }
  async function load() {
    loading = true; error = "";
    try { items = (await api("/backend/developer-faq")).items; } catch (e) { error = e instanceof Error ? e.message : String(e); } finally { loading = false; }
  }
  onMount(load);

  async function save() {
    saving = true; error = ""; notice = "";
    try {
      const body = JSON.stringify({ question, answer, opey_prompt: opeyPrompt, category, sort_order: Number(sortOrder) || 0 });
      if (editingId) {
        const current = items.find((i) => i.id === editingId);
        await api(`/backend/developer-faq/${encodeURIComponent(editingId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, opey_prompt: opeyPrompt, category, sort_order: Number(sortOrder) || 0, chat_room_id: current?.chat_room_id ?? "", chat_joining_key: current?.chat_joining_key ?? "" }) });
        notice = "Question updated";
      } else {
        await api("/backend/developer-faq", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        notice = "Question added";
      }
      formOpen = false;
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  let busyId = $state("");
  async function remove(item: FaqItem) {
    busyId = item.id; error = ""; notice = "";
    try { await api(`/backend/developer-faq/${encodeURIComponent(item.id)}`, { method: "DELETE" }); notice = "Question deleted"; await load(); }
    catch (e) { error = e instanceof Error ? e.message : String(e); } finally { busyId = ""; }
  }
  async function createChatRoom(item: FaqItem) {
    busyId = item.id; error = ""; notice = "";
    try {
      const result = await api(`/backend/developer-faq/${encodeURIComponent(item.id)}/chat-room`, { method: "POST" });
      notice = `Chat room "${result.chat_room?.name}" created and linked`;
      await load();
    } catch (e) { error = e instanceof Error ? e.message : String(e); } finally { busyId = ""; }
  }

  // ---- Opey: fills the question form ----
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    question: { get: () => question, set: (v) => (question = asText(v)) },
    answer: { get: () => answer, set: (v) => (answer = asText(v)) },
    opey_prompt: { get: () => opeyPrompt, set: (v) => (opeyPrompt = asText(v)) },
    category: { get: () => category, set: (v) => (category = asText(v)) },
    sort_order: { get: () => sortOrder, set: (v) => (sortOrder = asText(v)) },
  };
  let opeyPrevious = $state<Record<string, string>>({});
  function applyDraft(fields: Record<string, unknown>) {
    const applied: string[] = []; const ignored: string[] = [];
    if (!formOpen) startNew();
    for (const [name, value] of Object.entries(fields ?? {})) {
      const access = draftFields[name];
      if (!access) { ignored.push(name); continue; }
      const before = access.get(); access.set(value);
      if (!(name in opeyPrevious)) opeyPrevious = { ...opeyPrevious, [name]: before };
      applied.push(name);
    }
    return { applied, ignored };
  }
  function revertField(name: string) {
    const access = draftFields[name]; if (!access || !(name in opeyPrevious)) return;
    access.set(opeyPrevious[name]); const { [name]: _d, ...rest } = opeyPrevious; opeyPrevious = rest;
  }
  function describeForm(): string {
    return [
      "Form: Developer FAQ question (shown publicly on the Portal's /faq page, grouped by category).",
      "Fields settable via set_form_fields: question (string), answer (Markdown string), opey_prompt (string: what the Portal's 'Ask Opey' button sends for this question; a good follow-up such as 'Explain X for my consumer and show me where to check it'), category (string; existing: " + (categories.join(", ") || "none") + "), sort_order (integer, lowest first within a category).",
      `The form is currently ${editingId ? "editing an existing question" : "adding a new question"}.`,
      "Existing questions (so you avoid duplicates and match the tone):",
      ...items.slice(0, 40).map((i) => `  [${i.category || "General"}] ${i.question}`),
      "Current values:",
      ...Object.entries(draftFields).map(([n, a]) => `  ${n}: ${a.get() === "" ? "(empty)" : JSON.stringify(a.get())}`),
    ].join("\n");
  }
  const bridgeTarget = { formName: "developer-faq", applyDraft, describe: describeForm };
  onMount(() => { formBridge.register(bridgeTarget); return () => formBridge.unregister(bridgeTarget); });
  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Draft a FAQ entry explaining how to get an API key and which authentication methods this Portal supports.", pillTitle: "API key question", icon: Wand2 },
    { questionString: "Draft a FAQ entry about what a consent is and how a user grants one to an app.", pillTitle: "Consents question", icon: CircleHelp },
  ];
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL, displayHeader: false, currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions, currentConsentInfo: page.data.opeyConsentInfo || undefined, displayConnectionPips: true, consentMetricsHref: "/metrics",
    initialAssistantMessage: "Tell me what developers keep asking and I'll draft the question and a Markdown answer for the Portal FAQ. You review it before saving.",
  };
</script>

<svelte:head><title>Developer FAQ - API Manager</title></svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100"><CircleHelp class="h-7 w-7" /> Developer FAQ</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        The questions shown on the Portal's FAQ page{#if portalUrl}, <a href="{portalUrl}/faq" class="underline" target="_blank" rel="noopener noreferrer">{portalUrl}/faq</a>{/if}. Each question can have its own group chat.
      </p>
    </div>
    <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick={startNew} data-testid="faq-new"><Plus class="h-4 w-4" /> New question</button>
  </div>

  {#if error}<p class="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="faq-error">{error}</p>{/if}
  {#if notice}<p class="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200" data-testid="faq-notice">{notice}</p>{/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="space-y-6">
      {#if formOpen}
        <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="faq-form" data-state={editingId ? "edit" : "new"}>
          <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{editingId ? "Edit question" : "New question"}</h2>
          {#if Object.keys(opeyPrevious).length > 0}
            <div class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <span>Opey filled:</span>
              {#each Object.keys(opeyPrevious) as name (name)}<span class="rounded-full bg-white px-2 py-0.5 dark:bg-gray-800">{name} <button type="button" class="underline" onclick={() => revertField(name)}>revert</button></span>{/each}
              <button type="button" class="ml-auto underline" onclick={() => (opeyPrevious = {})}>Keep all</button>
            </div>
          {/if}
          <div class="grid gap-3 md:grid-cols-[1fr_12rem_6rem]">
            <label class="flex flex-col gap-1 text-sm md:col-span-3"><span class="font-medium text-gray-700 dark:text-gray-300">Question</span><input type="text" name="question" bind:value={question} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="faq-question" /></label>
            <label class="flex flex-col gap-1 text-sm md:col-span-3"><span class="font-medium text-gray-700 dark:text-gray-300">Answer (Markdown)</span><textarea name="answer" bind:value={answer} rows="6" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="faq-answer"></textarea></label>
            <label class="flex flex-col gap-1 text-sm md:col-span-3"><span class="font-medium text-gray-700 dark:text-gray-300">Opey prompt (optional)</span><input type="text" name="opey_prompt" bind:value={opeyPrompt} placeholder="What 'Ask Opey' sends; empty sends the question itself" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="faq-opey-prompt" /></label>
            <label class="flex flex-col gap-1 text-sm md:col-span-2"><span class="font-medium text-gray-700 dark:text-gray-300">Category</span><input type="text" name="category" list="faq-categories" bind:value={category} placeholder="General" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="faq-category" /><datalist id="faq-categories">{#each categories as c (c)}<option value={c}></option>{/each}</datalist></label>
            <label class="flex flex-col gap-1 text-sm"><span class="font-medium text-gray-700 dark:text-gray-300">Sort order</span><input type="number" name="sort_order" bind:value={sortOrder} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="faq-sort-order" /></label>
          </div>
          <div class="mt-3 flex gap-2">
            <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={saving || !question.trim() || !answer.trim()} onclick={save} data-testid="faq-save">{saving ? "Saving…" : editingId ? "Save changes" : "Add question"}</button>
            <button type="button" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={() => (formOpen = false)}>Cancel</button>
          </div>
        </section>
      {/if}

      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {#if loading}
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        {:else if items.length === 0}
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400" data-testid="faq-empty">No questions yet.</p>
        {:else}
          <ul class="divide-y divide-gray-200 dark:divide-gray-700" data-testid="faq-list">
            {#each items as item (item.id)}
              <li class="flex flex-wrap items-start gap-3 px-4 py-3" data-testid="faq-row" data-state={item.chat_room_id ? "chat-linked" : "no-chat"}>
                <div class="min-w-0 flex-1">
                  <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.category || "General"} · {item.sort_order}</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">{item.question}</div>
                  <p class="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{item.answer}</p>
                  {#if item.chat_room_id}
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <MessagesSquare class="inline h-3.5 w-3.5" /> Chat room <code>{item.chat_room_id}</code>
                      {#if portalUrl}<a href="{portalUrl}/user/chat/join?joining_key={encodeURIComponent(item.chat_joining_key)}" target="_blank" rel="noopener noreferrer" class="ml-1 inline-flex items-center gap-0.5 underline">open <ExternalLink class="h-3 w-3" /></a>{/if}
                    </p>
                  {/if}
                </div>
                <div class="flex flex-wrap gap-2">
                  {#if !item.chat_room_id}
                    <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:hover:bg-gray-700" disabled={busyId === item.id} onclick={() => createChatRoom(item)} data-testid="faq-create-chat"><MessagesSquare class="h-3.5 w-3.5" /> {busyId === item.id ? "Creating…" : "Create chat room"}</button>
                  {/if}
                  <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700" onclick={() => startEdit(item)} data-testid="faq-edit"><Pencil class="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" disabled={busyId === item.id} onclick={() => remove(item)} data-testid="faq-delete"><Trash2 class="h-3.5 w-3.5" /> Delete</button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>

    <aside class="lg:sticky lg:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-8rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
