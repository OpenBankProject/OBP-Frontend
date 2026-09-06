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
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat, AppStudioPreview } from "@obp/shared/components";
  import { appStudioPathToProxyPath } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion, AppStudioProxyResult } from "@obp/shared/components";
  import { describeLandingBlocksForOpey, initLandingBehaviours, LANDING_BASE_CSS } from "@obp/shared/landing";
  import { Smartphone, LayoutTemplate, Monitor, Play, Copy, Download, RotateCcw, Landmark, ListOrdered, Wand2, Megaphone, Handshake, KeyRound, ShieldCheck, Save, Globe, FolderOpen, Trash2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import { STARTER_APP_TITLE, STARTER_APP_HTML, STARTER_LANDING_TITLE, STARTER_LANDING_HTML } from "./starters";

  // ---- Modes ------------------------------------------------------------------
  // "app": a self-contained web app with JavaScript, run in a sandboxed iframe,
  //        calling OBP through the injected `obp` shim (the user's access, GET unattended).
  // "page": a Portal page, HTML + CSS + live-data tags + behaviours, no script.
  //        Expanded and stripped on the server, then shown inline with the behaviours wired.
  type Mode = "app" | "page";
  let mode = $state<Mode>(page.url.searchParams.get("mode") === "page" ? "page" : "app");

  // Starter sources live in starters.ts: a literal style or script tag inside this
  // component confuses svelte2tsx (svelte-check), even inside a string or comment.
  // ---- Source, per mode ---------------------------------------------------------
  let title = $state(STARTER_APP_TITLE);
  let source = $state(STARTER_APP_HTML);
  let runId = $state(1);
  let opeyPreviousSource = $state<string | null>(null);
  let opeyPreviousTitle = $state<string | null>(null);
  let previewWidth = $state<"phone" | "desktop">("phone");

  // Landing preview state
  let expandedHtml = $state("");
  let expanding = $state(false);
  let expandError = $state("");
  let landingEl = $state<HTMLElement | null>(null);

  function run() {
    runId += 1;
    logs = [];
    network = [];
    if (mode === "page") void expandLanding();
  }

  async function expandLanding() {
    expanding = true;
    expandError = "";
    try {
      const response = await fetch("/backend/app-studio/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      expandedHtml = data.html ?? "";
    } catch (e) {
      expandError = e instanceof Error ? e.message : String(e);
      expandedHtml = "";
    } finally {
      expanding = false;
    }
  }

  // Wire behaviours into the inline landing preview each time it re-renders.
  $effect(() => {
    void expandedHtml;
    if (mode !== "page" || !landingEl) return;
    return initLandingBehaviours(landingEl);
  });

  function switchMode(next: Mode) {
    if (next === mode) return;
    mode = next;
    startNewPage();
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
    if (next === "page") {
      source = STARTER_LANDING_HTML;
      title = STARTER_LANDING_TITLE;
      previewWidth = "desktop";
    } else {
      source = STARTER_APP_HTML;
      title = STARTER_APP_TITLE;
      previewWidth = "phone";
    }
    run();
  }

  function resetToStarter() {
    source = mode === "page" ? STARTER_LANDING_HTML : STARTER_APP_HTML;
    title = mode === "page" ? STARTER_LANDING_TITLE : STARTER_APP_TITLE;
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
    run();
  }

  onMount(() => {
    // A page handed over from the blocks demo ("Open in App Studio").
    if (mode === "page") {
      const handed = sessionStorage.getItem("app-studio:landing-source");
      if (handed) {
        source = handed;
        title = sessionStorage.getItem("app-studio:landing-title") ?? STARTER_LANDING_TITLE;
        sessionStorage.removeItem("app-studio:landing-source");
        sessionStorage.removeItem("app-studio:landing-title");
      } else {
        source = STARTER_LANDING_HTML;
        title = STARTER_LANDING_TITLE;
      }
      previewWidth = "desktop";
      void expandLanding();
    }
  });

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
  let copied = $state(false);

  const downloadHref = $derived("data:text/html;charset=utf-8," + encodeURIComponent(source));
  const downloadName = $derived(
    (title || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".html",
  );

  // ---- App mode: whose access the app's calls use --------------------------------
  // "session": the API Manager proxies with the user's OAuth2 bearer token (everything the user can do).
  // "consent": the API Manager proxies with a consent the user creates here for one of their consumers,
  //            scoped to chosen accounts and roles. The JWT and consumer key stay in this page; the app never sees them.
  type Access = "session" | "consent";
  let access = $state<Access>("session");

  interface ConsentView { bank_id: string; account_id: string; view_id: string }
  interface ConsentRole { bank_id: string; role_name: string }
  interface StudioConsent {
    consent_id: string;
    consent_jwt: string;
    consumer_key: string;
    consumer_id: string;
    consumer_name: string;
    views: ConsentView[];
    entitlements: ConsentRole[];
    expires_at: string;
  }
  let consent = $state<StudioConsent | null>(null);
  // Created but not yet ACCEPTED: OBP has sent the user a code to confirm it.
  let pendingConsent = $state<(StudioConsent & { bank_id: string }) | null>(null);
  let challengeAnswer = $state("");
  let challengeSubmitting = $state(false);

  interface ConsentOptions {
    consumers: Array<{ consumer_id: string; app_name: string; enabled: boolean }>;
    accounts: Array<{ bank_id: string; account_id: string; label: string }>;
    entitlements: Array<{ role_name: string; bank_id: string }>;
  }
  let consentOptions = $state<ConsentOptions | null>(null);
  let consentOptionsError = $state("");
  let consentCreating = $state(false);
  let consentError = $state("");

  // Form
  let formConsumerId = $state("");
  let formConsumerKey = $state("");
  let formViewId = $state("owner");
  let formTtlMinutes = $state(60);
  let formAccountFilter = $state("");
  let formRoleFilter = $state("");
  let formAccounts = $state<Record<string, boolean>>({});
  let formRoles = $state<Record<string, boolean>>({});

  const MAX_LIST = 60;
  const filteredAccounts = $derived.by(() => {
    const q = formAccountFilter.trim().toLowerCase();
    const all = consentOptions?.accounts ?? [];
    const hits = q ? all.filter((a) => `${a.label} ${a.bank_id} ${a.account_id}`.toLowerCase().includes(q)) : all;
    return hits.slice(0, MAX_LIST);
  });
  const filteredRoles = $derived.by(() => {
    const q = formRoleFilter.trim().toLowerCase();
    const all = consentOptions?.entitlements ?? [];
    const hits = q ? all.filter((e) => `${e.role_name} ${e.bank_id}`.toLowerCase().includes(q)) : all;
    return hits.slice(0, MAX_LIST);
  });
  const accountKey = (a: { bank_id: string; account_id: string }) => `${a.bank_id}/${a.account_id}`;
  const roleKey = (e: { bank_id: string; role_name: string }) => `${e.bank_id}/${e.role_name}`;
  const selectedAccountCount = $derived(Object.values(formAccounts).filter(Boolean).length);
  const selectedRoleCount = $derived(Object.values(formRoles).filter(Boolean).length);

  async function loadConsentOptions() {
    if (consentOptions) return;
    consentOptionsError = "";
    try {
      const response = await fetch("/backend/app-studio/consent", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      consentOptions = data;
      if (!formConsumerId && data.consumers?.length === 1) formConsumerId = data.consumers[0].consumer_id;
    } catch (e) {
      consentOptionsError = e instanceof Error ? e.message : String(e);
    }
  }

  function selectAccess(next: Access) {
    access = next;
    if (next === "consent") void loadConsentOptions();
  }

  async function createConsent() {
    consentError = "";
    if (!formConsumerId) { consentError = "Choose the consumer the consent is issued to."; return; }
    if (!formConsumerKey.trim()) { consentError = "Enter that consumer's key: OBP needs it on every consent call."; return; }
    const views: ConsentView[] = (consentOptions?.accounts ?? [])
      .filter((a) => formAccounts[accountKey(a)])
      .map((a) => ({ bank_id: a.bank_id, account_id: a.account_id, view_id: formViewId.trim() || "owner" }));
    const entitlements: ConsentRole[] = (consentOptions?.entitlements ?? [])
      .filter((e) => formRoles[roleKey(e)])
      .map((e) => ({ bank_id: e.bank_id, role_name: e.role_name }));
    consentCreating = true;
    try {
      const response = await fetch("/backend/app-studio/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ consumer_id: formConsumerId, views, entitlements, time_to_live: Math.max(60, formTtlMinutes * 60) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      const consumer = consentOptions?.consumers.find((c) => c.consumer_id === formConsumerId);
      const created: StudioConsent = {
        consent_id: data.consent_id,
        consent_jwt: data.consent_jwt,
        consumer_key: formConsumerKey.trim(),
        consumer_id: formConsumerId,
        consumer_name: consumer?.app_name ?? formConsumerId,
        views: data.views ?? views,
        entitlements: data.entitlements ?? entitlements,
        expires_at: data.expires_at,
      };
      formConsumerKey = "";
      if (String(data.status).toUpperCase() === "ACCEPTED") {
        consent = created;
        run();
      } else {
        // OBP answers the challenge on a bank-scoped route; any bank the consent touches will do.
        const bankId = views[0]?.bank_id || entitlements.find((e) => e.bank_id)?.bank_id || consentOptions?.accounts[0]?.bank_id || "";
        pendingConsent = { ...created, bank_id: bankId };
        challengeAnswer = "";
      }
    } catch (e) {
      consentError = e instanceof Error ? e.message : String(e);
    } finally {
      consentCreating = false;
    }
  }

  function dropConsent() {
    consent = null;
    pendingConsent = null;
    run();
  }

  async function answerChallenge() {
    if (!pendingConsent) return;
    consentError = "";
    if (!challengeAnswer.trim()) { consentError = "Enter the code OBP sent you."; return; }
    challengeSubmitting = true;
    try {
      const response = await fetch("/backend/app-studio/consent/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ consent_id: pendingConsent.consent_id, bank_id: pendingConsent.bank_id, answer: challengeAnswer.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      if (String(data.status).toUpperCase() !== "ACCEPTED") throw new Error(`Consent is ${data.status}, not ACCEPTED`);
      const { bank_id: _bank, ...accepted } = pendingConsent;
      consent = { ...accepted, consent_jwt: data.consent_jwt || accepted.consent_jwt };
      pendingConsent = null;
      challengeAnswer = "";
      run();
    } catch (e) {
      consentError = e instanceof Error ? e.message : String(e);
    } finally {
      challengeSubmitting = false;
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  // ---- App mode: the sandboxed app's OBP calls ------------------------------------
  interface NetworkEntry { method: string; path: string; status: number; ms: number; error?: string }
  interface LogEntry { level: "log" | "warn" | "error"; message: string }
  let network = $state<NetworkEntry[]>([]);
  let logs = $state<LogEntry[]>([]);
  const MAX_ENTRIES = 40;

  function pushNetwork(entry: NetworkEntry) {
    network = [...network.slice(-(MAX_ENTRIES - 1)), entry];
  }
  function pushLog(entry: LogEntry) {
    logs = [...logs.slice(-(MAX_ENTRIES - 1)), entry];
  }

  async function handleAppRequest(req: { method: string; path: string; body?: unknown }): Promise<AppStudioProxyResult> {
    const started = performance.now();
    const usingConsent = access === "consent";
    if (usingConsent && !consent) {
      const error = "Consent access is selected but no consent has been created yet";
      pushNetwork({ method: req.method, path: req.path, status: 0, ms: 0, error });
      return { ok: false, status: 401, error };
    }
    const proxyPath = appStudioPathToProxyPath(req.path, usingConsent ? "/backend/app-studio/obp" : "/proxy/obp");
    if (!proxyPath) {
      const error = `Path must start with /obp/ (got ${JSON.stringify(req.path)})`;
      pushNetwork({ method: req.method, path: req.path, status: 0, ms: 0, error });
      return { ok: false, status: 400, error };
    }
    const method = req.method.toUpperCase();
    // Only reads run unattended. Anything that writes needs a human click, because the
    // code making the call was written by the model and runs with the user's own access.
    if (method !== "GET" && method !== "HEAD") {
      const allowed = confirm(`The app wants to ${method} ${req.path}.\n\nAllow this call?`);
      if (!allowed) {
        const error = `${method} ${req.path} blocked by the user`;
        pushNetwork({ method, path: req.path, status: 0, ms: 0, error });
        return { ok: false, status: 403, error };
      }
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (usingConsent && consent) {
        headers["X-App-Studio-Consent-JWT"] = consent.consent_jwt;
        headers["X-App-Studio-Consumer-Key"] = consent.consumer_key;
      }
      const response = await fetch(proxyPath, {
        method,
        headers,
        credentials: "include",
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await response.text();
      let body: unknown = text;
      try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      const error = response.ok ? undefined : ((body as any)?.message ?? `HTTP ${response.status}`);
      pushNetwork({ method, path: req.path, status: response.status, ms: Math.round(performance.now() - started), error });
      return { ok: response.ok, status: response.status, body, error };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      pushNetwork({ method, path: req.path, status: 0, ms: Math.round(performance.now() - started), error });
      return { ok: false, status: 0, error };
    }
  }

  // The app asked the host to navigate (obp.navigate). In the studio we only record it;
  // the Portal, when it hosts a published app, follows it.
  function handleAppNavigate(url: string) {
    pushLog({ level: "log", message: `App asked to navigate to ${url} (not followed in the studio)` });
  }

  // ---- Saving and publishing (obp_portal_page dynamic entity) ----------------------------
  interface SavedPage {
    id: string;
    slug: string;
    title: string;
    kind: "page" | "app";
    status: "draft" | "published";
    summary: string;
    author: string;
    updated_at: string;
    source_length?: number;
  }
  let currentPage = $state<SavedPage | null>(null);
  let savedPages = $state<SavedPage[]>([]);
  let savedPagesError = $state("");
  let slug = $state("");
  let summary = $state("");
  let saving = $state(false);
  let saveError = $state("");
  let saveMessage = $state("");
  let openId = $state("");

  const slugFromTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

  async function loadSavedPages() {
    savedPagesError = "";
    try {
      const response = await fetch("/backend/app-studio/pages", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      savedPages = data.pages ?? [];
    } catch (e) {
      savedPagesError = e instanceof Error ? e.message : String(e);
    }
  }

  async function savePage(status: "draft" | "published") {
    saveError = "";
    saveMessage = "";
    const effectiveSlug = slug.trim() || slugFromTitle(title);
    if (!title.trim()) { saveError = "Give the page a title first."; return; }
    if (!effectiveSlug) { saveError = "Give the page a slug."; return; }
    slug = effectiveSlug;
    saving = true;
    try {
      const body = { slug: effectiveSlug, title: title.trim(), kind: mode, status, summary: summary.trim(), source };
      const isUpdate = !!currentPage;
      const response = await fetch(isUpdate ? `/backend/app-studio/pages/${encodeURIComponent(currentPage!.id)}` : "/backend/app-studio/pages", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      currentPage = data.page;
      saveMessage = status === "published" ? `Published as /pages/${data.page.slug}` : `Saved draft ${data.page.slug}`;
      await loadSavedPages();
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function openSavedPage(id: string) {
    if (!id) return;
    saveError = "";
    saveMessage = "";
    try {
      const response = await fetch(`/backend/app-studio/pages/${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      const page: SavedPage & { source: string } = data.page;
      if (page.kind !== mode) {
        mode = page.kind;
        previewWidth = page.kind === "page" ? "desktop" : "phone";
      }
      opeyPreviousSource = null;
      opeyPreviousTitle = null;
      source = page.source;
      title = page.title;
      slug = page.slug;
      summary = page.summary;
      currentPage = page;
      openId = "";
      run();
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    }
  }

  async function deleteCurrentPage() {
    if (!currentPage) return;
    saveError = "";
    try {
      const response = await fetch(`/backend/app-studio/pages/${encodeURIComponent(currentPage.id)}`, { method: "DELETE", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `HTTP ${response.status}`);
      saveMessage = `Deleted ${currentPage.slug}`;
      currentPage = null;
      await loadSavedPages();
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    }
  }

  function startNewPage() {
    currentPage = null;
    slug = "";
    summary = "";
    saveMessage = "";
    saveError = "";
  }

  onMount(() => {
    void loadSavedPages();
  });

  // ---- Opey: the page is a one-field form Opey fills via set_form_fields -----------
  const MAX_SOURCE_IN_CONTEXT = 14000;

  function applyDraft(fields: Record<string, unknown>): { applied: string[]; ignored: string[] } {
    const applied: string[] = [];
    const ignored: string[] = [];
    let changed = false;
    for (const [name, value] of Object.entries(fields ?? {})) {
      if (name === "html") {
        if (typeof value !== "string" || !value.trim()) { ignored.push(name); continue; }
        if (opeyPreviousSource === null) opeyPreviousSource = source;
        source = value;
        applied.push(name);
        changed = true;
      } else if (name === "title") {
        if (opeyPreviousTitle === null) opeyPreviousTitle = title;
        title = String(value ?? "");
        applied.push(name);
      } else {
        ignored.push(name);
      }
    }
    if (changed) run();
    return { applied, ignored };
  }

  function revertOpey() {
    if (opeyPreviousSource !== null) source = opeyPreviousSource;
    if (opeyPreviousTitle !== null) title = opeyPreviousTitle;
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
    run();
  }
  function keepOpey() {
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
  }

  function currentSourceForContext(): string {
    return source.length > MAX_SOURCE_IN_CONTEXT
      ? source.slice(0, MAX_SOURCE_IN_CONTEXT) + `\n<!-- … truncated, ${source.length} chars total -->`
      : source;
  }

  function describeAppMode(): string {
    return [
      "Form: App Studio, APP mode (a single-page mobile web app with JavaScript that calls the OBP API).",
      "Fields settable via set_form_fields:",
      "- html (string, REQUIRED: the COMPLETE HTML document — doctype, head, styles, body and scripts. Always send the whole document, never a fragment or a diff.)",
      "- title (string, short app name)",
      "",
      "Runtime the app runs in:",
      previewWidth === "phone"
        ? "- A 390x780 phone-sized sandboxed iframe. No cookies, no localStorage across runs, no access to the host page."
        : "- A page-width sandboxed iframe whose height follows the app's content (the shim reports it). No cookies, no localStorage across runs, no access to the host page. Design responsively; it is also shown on phones.",
      "- obp.navigate(url) asks the hosting page to navigate (e.g. to /login or a product page); use it for links that must leave the app. Ordinary <a href> links stay inside the iframe.",
      "- A global `obp` object is injected before the app's scripts:",
      "    await obp.get('/obp/v6.0.0/banks')            -> parsed JSON, throws Error(message) with .status on non-2xx",
      "    await obp.post(path, bodyObject) / obp.put(path, bodyObject) / obp.delete(path)",
      "    await obp.request(method, path, body)        -> { ok, status, body, error } (never throws)",
      "- Paths MUST start with /obp/ and include the version, e.g. /obp/v6.0.0/my/accounts. Query strings are allowed.",
      access === "consent" && consent
        ? `- ACCESS: the API Manager proxies calls with a CONSENT for consumer ${JSON.stringify(consent.consumer_name)}: ${consent.views.length} account view(s) [${consent.views.slice(0, 8).map((v) => `${v.bank_id}/${v.account_id}/${v.view_id}`).join(", ")}${consent.views.length > 8 ? ", …" : ""}] and ${consent.entitlements.length} role(s) [${consent.entitlements.slice(0, 8).map((e) => `${e.role_name}@${e.bank_id || "system"}`).join(", ")}${consent.entitlements.length > 8 ? ", …" : ""}]. Only those accounts and roles work; anything else returns 401/403. Expires ${consent.expires_at}.`
        : access === "consent"
          ? "- ACCESS: consent selected but NOT created yet; every call fails with 401 until the user creates one."
          : "- ACCESS: the API Manager proxies calls with the current user's own OAuth2 session (everything the user can do).",
      "- GET runs unattended; POST/PUT/DELETE prompt the user to allow each call.",
      "- Do NOT use fetch()/XMLHttpRequest for OBP; only `obp.*`. External CSS/JS via CDN link/script-src elements is allowed but plain HTML/CSS/JS is preferred.",
      "- console.log/warn/error and uncaught errors are relayed to the host and shown to you below, so check them after each change.",
      "- Use your OBP endpoint tools (get_endpoint_schema, list_endpoints_by_tag) to confirm paths and response shapes before writing calls.",
      "- Design for a phone: mobile-first, touch-sized targets, no horizontal scrolling. Keep it self-contained and readable.",
      "",
      `Current title: ${JSON.stringify(title)}`,
      "Current html:",
      currentSourceForContext(),
      "",
      network.length ? "Recent OBP calls from the app (most recent last):" : "Recent OBP calls from the app: none yet.",
      ...network.slice(-15).map((n) => `  ${n.method} ${n.path} -> ${n.status || "no response"}${n.error ? ` (${n.error})` : ""} ${n.ms}ms`),
      logs.length ? "Recent console output / errors (most recent last):" : "Console output: none.",
      ...logs.slice(-20).map((l) => `  [${l.level}] ${l.message.slice(0, 500)}`),
    ].join("\n");
  }

  function describePageMode(): string {
    const errors = [...expandedHtml.matchAll(/<div class="obp-block-error"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1]);
    return [
      "Form: App Studio, PAGE mode (a page for the OBP Portal: HTML + CSS + live-data tags + behaviours, no code).",
      "Fields settable via set_form_fields:",
      "- html (string, REQUIRED: the COMPLETE page source. A fragment: ONE style element followed by ONE wrapper div with class=\"YOUR-CLASS obp-landing\". No doctype, html, head or body elements. Scope every CSS selector under your wrapper class.)",
      "- title (string, short page name)",
      "",
      "Rules: NO script elements, NO inline event handlers, NO link or iframe elements — they are stripped. Behaviour comes only from data-behaviour attributes; live data only from the obp-* tags.",
      `Preview width: ${previewWidth === "phone" ? "390px phone" : "desktop"}. Design responsively for both.`,
      "",
      describeLandingBlocksForOpey(),
      "",
      `Current title: ${JSON.stringify(title)}`,
      "Current html:",
      currentSourceForContext(),
      "",
      expandError ? `Last render FAILED: ${expandError}` : errors.length ? "Block errors in the last render:" : "Last render: OK, no block errors.",
      ...errors.map((e) => `  ${e}`),
    ].join("\n");
  }

  const bridgeTarget = {
    formName: "app-studio",
    applyDraft,
    describe: () => (mode === "page" ? describePageMode() : describeAppMode()),
  };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  const clientTools = {
    set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}),
  };
  const clientContext = () => formBridge.describe();

  const appQuestions: SuggestedQuestion[] = [
    { questionString: "Build a mobile banking home screen that lists my accounts with their balances, grouped by bank.", pillTitle: "My accounts screen", icon: Landmark },
    { questionString: "Add a transactions screen: tapping an account shows its latest transactions with amounts and descriptions, and a back button.", pillTitle: "Add transactions", icon: ListOrdered },
    { questionString: "Restyle the app with a dark theme, larger touch targets and a bottom tab bar.", pillTitle: "Restyle it", icon: Wand2 },
  ];
  const pageQuestions: SuggestedQuestion[] = [
    { questionString: "Write a hackathon landing page: bold hero, a countdown to three weeks from now, three product cards, the endpoints of a collection, a schedule as tabs and a register button.", pillTitle: "Hackathon page", icon: Megaphone },
    { questionString: "Write a partner programme page with an editorial, light look: products as a list with prices, three tiers, banks row and an apply button.", pillTitle: "Partner programme", icon: Handshake },
    { questionString: "Change the colour scheme to the bank's brand: deep green and gold, and make the hero full-bleed.", pillTitle: "Rebrand it", icon: Wand2 },
  ];

  const opeyChatOptions = $derived<Partial<OpeyChatOptions>>({
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions: mode === "page" ? pageQuestions : appQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage:
      mode === "page"
        ? "Describe the page you want. I'll write it as HTML and CSS using the live catalogue tags and behaviours, and it renders in the preview with real data. Tell me what to change."
        : "Describe the app you want and I'll write it as a phone-sized web page that calls the OBP API through `obp.get(...)`. It runs in the preview straight away, and I can see its console and API calls, so tell me what to change.",
  });

  function handleEditorKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }
</script>

<svelte:head>
  <title>App Studio - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-[110rem] px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        <Smartphone class="h-7 w-7" />
        App Studio
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        {#if mode === "page"}
          Page: no code, lives in the Portal. Opey writes HTML and CSS; live-data tags are filled from the catalogue on the server and
          behaviours come from data attributes. See the <a href="/app-studio/blocks" class="underline">blocks</a> demo and the <a href="/app-studio/help" class="underline">help</a>.
        {:else}
          App: runs code, sealed off from the Portal. Opey writes a phone-sized web app that calls the OBP API through the API Manager,
          using your access. Reads run unattended; writes ask you first.
        {/if}
      </p>
    </div>
    <div class="inline-flex rounded-md border border-gray-300 dark:border-gray-600" role="tablist" aria-label="Studio mode" data-testid="app-studio-mode" data-state={mode}>
      <button type="button" role="tab" aria-selected={mode === "app"} class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium {mode === 'app' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}" onclick={() => switchMode("app")} data-testid="app-studio-mode-app">
        <Smartphone class="h-4 w-4" /> App
      </button>
      <button type="button" role="tab" aria-selected={mode === "page"} class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium {mode === 'page' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}" onclick={() => switchMode("page")} data-testid="app-studio-mode-page">
        <LayoutTemplate class="h-4 w-4" /> Page
      </button>
    </div>
  </div>

  {#if opeyPreviousSource !== null || opeyPreviousTitle !== null}
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
      data-testid="app-studio-opey-banner"
    >
      <span>Opey updated the {mode === "page" ? "page" : "app"}. Review the preview, then keep or revert.</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-md border border-blue-300 px-3 py-1 font-medium hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/40" onclick={revertOpey} data-testid="app-studio-revert">Revert</button>
        <button type="button" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700" onclick={keepOpey} data-testid="app-studio-keep">Keep</button>
      </div>
    </div>
  {/if}

  <div class="grid gap-6 {previewWidth === 'desktop' ? 'xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]' : 'xl:grid-cols-[minmax(0,1fr)_auto_minmax(20rem,26rem)]'}">
    <div class="flex min-w-0 flex-col gap-6">
      {#if mode === "app"}
        <!-- Access: whose credentials the app's OBP calls use -->
        <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="app-studio-access" data-state={access}>
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">The app calls OBP with</span>
            <div class="inline-flex rounded-md border border-gray-300 dark:border-gray-600" role="radiogroup" aria-label="Access">
              <button type="button" role="radio" aria-checked={access === "session"} class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium {access === 'session' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}" onclick={() => selectAccess("session")} data-testid="app-studio-access-session">
                <KeyRound class="h-4 w-4" /> Your session
              </button>
              <button type="button" role="radio" aria-checked={access === "consent"} class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium {access === 'consent' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}" onclick={() => selectAccess("consent")} data-testid="app-studio-access-consent">
                <ShieldCheck class="h-4 w-4" /> A consent
              </button>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {#if access === "session"}
                Your OAuth2 bearer token, everything you can do. The token stays on the server.
              {:else if consent}
                Consent <code>{consent.consent_id}</code> for {consent.consumer_name}: {consent.views.length} account view{consent.views.length === 1 ? "" : "s"}, {consent.entitlements.length} role{consent.entitlements.length === 1 ? "" : "s"}, until {formatTime(consent.expires_at)}.
              {:else if pendingConsent}
                Consent <code>{pendingConsent.consent_id}</code> created for {pendingConsent.consumer_name}. OBP has sent you a code to confirm it.
              {:else}
                A consent you create here for one of your consumers, limited to the accounts and roles you pick.
              {/if}
            </span>
            {#if access === "consent" && (consent || pendingConsent)}
              <button type="button" class="ml-auto rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={dropConsent} data-testid="app-studio-consent-drop">{consent ? "Drop consent" : "Cancel"}</button>
            {/if}
          </div>

          {#if access === "consent" && pendingConsent}
            <div class="mt-4 flex flex-wrap items-center gap-3" data-testid="app-studio-consent-challenge">
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                Code from the email or SMS
                <input type="text" name="challenge_answer" inputmode="numeric" autocomplete="one-time-code" class="w-32 rounded-md border border-gray-300 px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={challengeAnswer} onkeydown={(e) => { if (e.key === "Enter") answerChallenge(); }} data-testid="app-studio-consent-answer" />
              </label>
              <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={challengeSubmitting} onclick={answerChallenge} data-testid="app-studio-consent-confirm">
                <ShieldCheck class="h-4 w-4" /> {challengeSubmitting ? "Confirming…" : "Confirm consent"}
              </button>
              {#if consentError}<span class="text-sm text-red-700 dark:text-red-300" data-testid="app-studio-consent-error">{consentError}</span>{/if}
            </div>
          {/if}

          {#if access === "consent" && !consent && !pendingConsent}
            <div class="mt-4 grid gap-4 md:grid-cols-2" data-testid="app-studio-consent-form">
              {#if consentOptionsError}
                <p class="md:col-span-2 text-sm text-red-700 dark:text-red-300">{consentOptionsError}</p>
              {:else if !consentOptions}
                <p class="md:col-span-2 text-sm text-gray-500 dark:text-gray-400">Loading your consumers, accounts and roles…</p>
              {:else}
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">Consumer the consent is issued to</span>
                  <select name="consumer_id" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={formConsumerId} data-testid="app-studio-consent-consumer">
                    <option value="" disabled>Choose a consumer</option>
                    {#each consentOptions.consumers as c (c.consumer_id)}
                      <option value={c.consumer_id}>{c.app_name}{c.enabled ? "" : " (disabled)"}</option>
                    {/each}
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">That consumer's key</span>
                  <input type="password" name="consumer_key" autocomplete="off" class="rounded-md border border-gray-300 px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={formConsumerKey} data-testid="app-studio-consent-consumer-key" />
                  <span class="text-xs text-gray-500 dark:text-gray-400">OBP requires the consumer key on every consent call. Kept in this page only.</span>
                </label>

                <div class="flex flex-col gap-1 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-700 dark:text-gray-300">Accounts ({selectedAccountCount} selected)</span>
                    <label class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">View <input type="text" name="view_id" class="w-20 rounded-md border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900" bind:value={formViewId} /></label>
                  </div>
                  <input type="search" name="account_filter" placeholder="Filter by label, bank or account id" class="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={formAccountFilter} />
                  <ul class="max-h-44 overflow-auto rounded-md border border-gray-200 p-1 dark:border-gray-700" data-testid="app-studio-consent-accounts">
                    {#each filteredAccounts as a (accountKey(a))}
                      <li>
                        <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input type="checkbox" name="account" value={accountKey(a)} bind:checked={formAccounts[accountKey(a)]} />
                          <span class="truncate">{a.label} <span class="text-xs text-gray-500 dark:text-gray-400">{a.bank_id} · {a.account_id}</span></span>
                        </label>
                      </li>
                    {/each}
                    {#if filteredAccounts.length === 0}<li class="px-1.5 py-0.5 text-xs text-gray-400">No accounts match.</li>{/if}
                    {#if (consentOptions.accounts.length > MAX_LIST) && filteredAccounts.length === MAX_LIST}<li class="px-1.5 py-0.5 text-xs text-gray-400">Showing the first {MAX_LIST}; filter to find others.</li>{/if}
                  </ul>
                </div>

                <div class="flex flex-col gap-1 text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">Roles ({selectedRoleCount} selected)</span>
                  <input type="search" name="role_filter" placeholder="Filter by role or bank" class="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={formRoleFilter} />
                  <ul class="max-h-44 overflow-auto rounded-md border border-gray-200 p-1 dark:border-gray-700" data-testid="app-studio-consent-roles">
                    {#each filteredRoles as e (roleKey(e))}
                      <li>
                        <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input type="checkbox" name="role" value={roleKey(e)} bind:checked={formRoles[roleKey(e)]} />
                          <span class="truncate">{e.role_name} <span class="text-xs text-gray-500 dark:text-gray-400">{e.bank_id || "system"}</span></span>
                        </label>
                      </li>
                    {/each}
                    {#if filteredRoles.length === 0}<li class="px-1.5 py-0.5 text-xs text-gray-400">No roles match.</li>{/if}
                    {#if (consentOptions.entitlements.length > MAX_LIST) && filteredRoles.length === MAX_LIST}<li class="px-1.5 py-0.5 text-xs text-gray-400">Showing the first {MAX_LIST}; filter to find others.</li>{/if}
                  </ul>
                </div>

                <div class="flex flex-wrap items-center gap-3 md:col-span-2">
                  <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">Valid for <input type="number" name="ttl_minutes" min="1" max="1440" class="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={formTtlMinutes} /> minutes</label>
                  <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={consentCreating} onclick={createConsent} data-testid="app-studio-consent-create">
                    <ShieldCheck class="h-4 w-4" /> {consentCreating ? "Creating…" : "Create consent"}
                  </button>
                  {#if consentError}<span class="text-sm text-red-700 dark:text-red-300" data-testid="app-studio-consent-error">{consentError}</span>{/if}
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <!-- Source -->
      <section class="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="app-studio-source">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">Title</span>
            <input type="text" name="title" class="input w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={title} data-testid="app-studio-title" />
          </label>
          <div class="ml-auto flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" onclick={run} data-testid="app-studio-run">
              <Play class="h-4 w-4" /> Run
            </button>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={copySource} data-testid="app-studio-copy">
              <Copy class="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
            <a href={downloadHref} download={downloadName} class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="app-studio-download">
              <Download class="h-4 w-4" /> Download
            </a>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={resetToStarter} data-testid="app-studio-reset">
              <RotateCcw class="h-4 w-4" /> Starter
            </button>
          </div>
        </div>
        <textarea
          name="html"
          class="min-h-[16rem] resize-y rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 {mode === 'page' ? 'h-[16rem]' : 'h-[28rem]'}"
          spellcheck="false"
          bind:value={source}
          onkeydown={handleEditorKeydown}
          data-testid="app-studio-html"
        ></textarea>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Ctrl+Enter runs it.
          {#if mode === "page"}
            Live data via <code>&lt;obp-products&gt;</code>, <code>&lt;obp-endpoints&gt;</code>, <code>&lt;obp-banks&gt;</code>, <code>&lt;obp-signup&gt;</code>, <code>&lt;obp-stat&gt;</code>; clicks via <code>data-behaviour</code>.
          {:else}
            The app calls OBP with <code>obp.get('/obp/v6.0.0/…')</code>.
          {/if}
        </p>

        {#if mode === "app"}
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <div class="rounded-md border border-gray-200 dark:border-gray-700">
              <div class="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">OBP calls</div>
              <ul class="max-h-40 overflow-auto p-2 font-mono text-xs" data-testid="app-studio-network">
                {#if network.length === 0}<li class="text-gray-400">None yet.</li>{/if}
                {#each network as n, i (i)}
                  <li class={n.error ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>{n.method} {n.path} → {n.status || "—"} {n.ms}ms{n.error ? ` · ${n.error}` : ""}</li>
                {/each}
              </ul>
            </div>
            <div class="rounded-md border border-gray-200 dark:border-gray-700">
              <div class="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">Console</div>
              <ul class="max-h-40 overflow-auto p-2 font-mono text-xs" data-testid="app-studio-console">
                {#if logs.length === 0}<li class="text-gray-400">Nothing logged.</li>{/if}
                {#each logs as l, i (i)}
                  <li class={l.level === "error" ? "text-red-600 dark:text-red-400" : l.level === "warn" ? "text-yellow-700 dark:text-yellow-300" : "text-gray-700 dark:text-gray-300"}>[{l.level}] {l.message}</li>
                {/each}
              </ul>
            </div>
          </div>
        {/if}
      </section>

      <!-- Save / publish to the Portal -->
      <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="app-studio-publish" data-state={currentPage ? currentPage.status : "unsaved"}>
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">Slug</span>
            <input type="text" name="slug" class="w-56 rounded-md border border-gray-300 px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-900" placeholder={slugFromTitle(title) || "my-page"} bind:value={slug} data-testid="app-studio-slug" />
          </label>
          <label class="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">Summary</span>
            <input type="text" name="summary" class="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" placeholder="One line for listings" bind:value={summary} data-testid="app-studio-summary" />
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" disabled={saving} onclick={() => savePage("draft")} data-testid="app-studio-save-draft">
              <Save class="h-4 w-4" /> {currentPage ? "Save" : "Save draft"}
            </button>
            <button type="button" class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60" disabled={saving} onclick={() => savePage("published")} data-testid="app-studio-publish-btn">
              <Globe class="h-4 w-4" /> {currentPage?.status === "published" ? "Republish" : "Publish to Portal"}
            </button>
            {#if currentPage?.status === "published"}
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" disabled={saving} onclick={() => savePage("draft")} data-testid="app-studio-unpublish">Unpublish</button>
            {/if}
            {#if currentPage}
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" onclick={deleteCurrentPage} data-testid="app-studio-delete">
                <Trash2 class="h-4 w-4" /> Delete
              </button>
            {/if}
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {#if currentPage}
            <span data-testid="app-studio-current-page">Editing <code>{currentPage.slug}</code> ({currentPage.kind}, {currentPage.status}, saved {currentPage.updated_at} by {currentPage.author || "unknown"})</span>
            {#if currentPage.status === "published" && page.data.externalLinks?.PORTAL_URL}
              <a href="{page.data.externalLinks.PORTAL_URL}/pages/{currentPage.slug}" target="_blank" rel="noopener noreferrer" class="underline" data-testid="app-studio-open-published">Open on the Portal</a>
            {/if}
            <button type="button" class="underline" onclick={startNewPage}>Start a new one</button>
          {:else}
            <span>Not saved yet. Saved as an <code>obp_portal_page</code> record in OBP; the Portal serves records with status published at <code>/pages/SLUG</code>.</span>
          {/if}
          <label class="ml-auto flex items-center gap-1">
            <FolderOpen class="h-3.5 w-3.5" />
            <select class="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900" bind:value={openId} onchange={() => openSavedPage(openId)} data-testid="app-studio-open-saved">
              <option value="">Open saved…</option>
              {#each savedPages as sp (sp.id)}
                <option value={sp.id}>{sp.title} · {sp.kind} · {sp.status}</option>
              {/each}
            </select>
          </label>
          {#if saveMessage}<span class="text-emerald-700 dark:text-emerald-300" data-testid="app-studio-save-message">{saveMessage}</span>{/if}
          {#if saveError}<span class="text-red-700 dark:text-red-300" data-testid="app-studio-save-error">{saveError}</span>{/if}
          {#if savedPagesError}<span class="text-red-700 dark:text-red-300">{savedPagesError}</span>{/if}
        </div>
      </section>

      <!-- App at page width sits under the editor; height follows the app's content -->
      {#if mode === "app" && previewWidth === "desktop"}
        <section data-testid="app-studio-preview" data-state="ready">
          <div class="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{title || "Untitled app"} · run {runId} · page width</span>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600" onclick={() => (previewWidth = "phone")} data-testid="app-studio-width-phone"><Smartphone class="h-3.5 w-3.5" /> Phone width</button>
          </div>
          <AppStudioPreview {source} {runId} layout="fill" onRequest={handleAppRequest} onLog={pushLog} onNavigate={handleAppNavigate} />
        </section>
      {/if}

      <!-- Landing preview at desktop width sits under the editor, full column width -->
      {#if mode === "page" && previewWidth === "desktop"}
        <section data-testid="app-studio-preview" data-state={expanding ? "rendering" : expandError ? "error" : "ready"}>
          <div class="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{title || "Untitled page"} · run {runId}{expanding ? " · rendering…" : ""}</span>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600" onclick={() => (previewWidth = "phone")} data-testid="app-studio-width-phone"><Smartphone class="h-3.5 w-3.5" /> Phone width</button>
          </div>
          {#if expandError}
            <div class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">{expandError}</div>
          {/if}
          {@html `<style>${LANDING_BASE_CSS}</style>`}
          {#key runId}
            <div bind:this={landingEl} class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700" data-testid="app-studio-landing">
              {@html expandedHtml}
            </div>
          {/key}
        </section>
      {/if}
    </div>

    <!-- Phone-sized preview column (either mode at phone width) -->
    {#if previewWidth === "phone"}
      <section class="xl:sticky xl:top-4 xl:self-start" data-testid="app-studio-preview" data-state={mode === "page" ? (expanding ? "rendering" : expandError ? "error" : "ready") : "ready"}>
        {#if mode === "app"}
          <AppStudioPreview {source} {runId} onRequest={handleAppRequest} onLog={pushLog} onNavigate={handleAppNavigate} />
          <p class="mt-2 flex items-center justify-center gap-3 text-center text-xs text-gray-500 dark:text-gray-400">
            <span>{title || "Untitled app"} · run {runId}</span>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600" onclick={() => (previewWidth = "desktop")} data-testid="app-studio-width-desktop"><Monitor class="h-3.5 w-3.5" /> Page width</button>
          </p>
        {:else}
          {#if expandError}
            <div class="mb-2 w-[410px] max-w-full rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">{expandError}</div>
          {/if}
          {@html `<style>${LANDING_BASE_CSS}</style>`}
          <div class="mx-auto rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-xl dark:border-gray-700" style="width: 410px; max-width: 100%;" data-testid="app-studio-phone">
            <div class="mx-auto mb-1 mt-2 h-1.5 w-20 rounded-full bg-gray-700"></div>
            <div class="overflow-auto rounded-[2rem] bg-white" style="height: 780px;">
              {#key runId}
                <div bind:this={landingEl} data-testid="app-studio-landing">{@html expandedHtml}</div>
              {/key}
            </div>
          </div>
          <p class="mt-2 flex items-center justify-center gap-3 text-center text-xs text-gray-500 dark:text-gray-400">
            <span>{title || "Untitled page"} · run {runId}{expanding ? " · rendering…" : ""}</span>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600" onclick={() => (previewWidth = "desktop")} data-testid="app-studio-width-desktop"><Monitor class="h-3.5 w-3.5" /> Desktop width</button>
          </p>
        {/if}
      </section>
    {/if}

    <!-- Opey pane: OpeyChat requires a definite height all the way down -->
    <aside class="xl:sticky xl:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm xl:h-[calc(100vh-8rem)] dark:border-gray-700">
        {#key mode}
          <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
        {/key}
      </div>
    </aside>
  </div>
</div>
