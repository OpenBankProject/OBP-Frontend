<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ToolMessage } from '$shared/opey/types';
	import { createLogger } from '$shared/utils/logger';
	import { Shield, CheckCircle, XCircle, KeyRound, Loader2, Eye, CreditCard, User } from '@lucide/svelte';
	import { expandRoleRequirements, deduplicateRoles } from '$shared/opey/utils/roles';
	import { getSelectedConsentViews, type ConsentViewSelection } from '$shared/opey/utils/consentScope';

	const logger = createLogger('ConsentRequestCard');

	interface Props {
		toolMessage: ToolMessage;
		onConsent: (toolCallId: string, consentJwt: string) => Promise<void>;
		onDeny: (toolCallId: string) => Promise<void>;
	}

	let { toolMessage, onConsent, onDeny }: Props = $props();

	let isProcessing = $state(false);
	let consentError = $state<string | null>(null);

	// Reactive count of (bank, account, view) tuples the user has pre-picked in
	// the Account Scope Picker. Refreshed off the picker's
	// 'obp:consent-scope-changed' event so the safeguard below clears the instant
	// the user actually selects an account.
	let selectedViewsCount = $state(0);
	function syncSelectedScope() {
		selectedViewsCount = getSelectedConsentViews().length;
	}
	onMount(() => {
		syncSelectedScope();
		if (typeof window !== 'undefined') {
			window.addEventListener('obp:consent-scope-changed', syncSelectedScope);
		}
	});
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('obp:consent-scope-changed', syncSelectedScope);
		}
	});

	// True when Opey flags this call as view-scoped but neither the event names a
	// (bank, account, view) tuple nor has the user pre-picked one. In that state
	// Grant would produce a consent with views:[] and the call would return empty
	// / 403 — so block Grant and route the user to the picker first.
	const needsViewScope = $derived(toolMessage.consentRequiresViewAccess === true);
	const eventNamesView = $derived(
		!!toolMessage.consentBankId &&
			!!toolMessage.consentAccountId &&
			!!toolMessage.consentViewId
	);
	const promptForScope = $derived(
		needsViewScope && !eventNamesView && selectedViewsCount === 0
	);

	function focusAccountScopePicker() {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(new CustomEvent('obp:open-account-scope-picker'));
	}

	/**
	 * Resolve the bank_id for bank-scoped consent roles.
	 * Priority: explicit consentBankId from backend > extracted from toolInput path_params.
	 */
	function resolveBankId(): string | undefined {
		// 1. Explicit bank_id from the consent_request event
		if (toolMessage.consentBankId) return toolMessage.consentBankId;

		// 2. Check if any role requires bank_id
		const needsBankId = (toolMessage.consentRequiredRoles || []).some((role: any) =>
			typeof role === 'object' && role?.requires_bank_id
		);
		if (!needsBankId) return undefined;

		// 3. Extract from toolInput path_params (set during the original tool call)
		const pathParams = toolMessage.toolInput?.path_params;
		if (pathParams?.BANK_ID) return pathParams.BANK_ID;
		if (pathParams?.bank_id) return pathParams.bank_id;

		return undefined;
	}

	// Compute the exact body the Grant button would POST to /backend/opey/consent.
	// Extracted so the dev debug panel can render the same value the network call
	// uses, without diverging.
	function buildConsentBody(): {
		required_roles: string[];
		bank_id?: string;
		views: ConsentViewSelection[];
	} {
		const normalizedRoles = deduplicateRoles(
			(toolMessage.consentRequiredRoles || []).map((role: any) => {
				if (typeof role === 'string') return role;
				// Handle object format: {role: "CanCreateBank", requires_bank_id: false}
				return role?.role || role?.role_name || role?.name || '';
			}).filter(Boolean)
		);
		const bankId = resolveBankId();
		// Views: the (bank, account, view) tuple the consent_request event itself
		// specified, plus anything the user pre-picked in the Account Scope Picker,
		// deduped on (bank_id, account_id, view_id).
		const eventView: ConsentViewSelection[] =
			bankId && toolMessage.consentAccountId && toolMessage.consentViewId
				? [{
						bank_id: bankId,
						account_id: toolMessage.consentAccountId,
						view_id: toolMessage.consentViewId
					}]
				: [];
		const seen = new Set<string>();
		const views = [...eventView, ...getSelectedConsentViews()].filter((v) => {
			const key = `${v.bank_id}|${v.account_id}|${v.view_id}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return { required_roles: normalizedRoles, bank_id: bankId, views };
	}

	// --- Dev-only debug surface --------------------------------------------
	// Lets the user see exactly what the frontend ships to /backend/opey/consent
	// and what comes back (decoded JWT payload), without digging through the
	// browser's Network tab. Gated on import.meta.env.DEV so production builds
	// strip the panel and the console.group entirely.
	const isDev = import.meta.env.DEV;
	let debugResponse = $state<{
		status: number;
		consent_jwt?: string;
		decodedJwt?: any;
		error?: string;
	} | null>(null);

	function decodeJwtPayload(jwt: string): any | null {
		try {
			const seg = jwt.split('.')[1];
			if (!seg) return null;
			const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
			return JSON.parse(atob(b64));
		} catch {
			return null;
		}
	}

	/**
	 * Create a role-specific consent via the server-side API route,
	 * then pass the JWT back to the chat controller.
	 */
	async function handleGrantConsent() {
		if (isProcessing) return;
		isProcessing = true;
		consentError = null;
		debugResponse = null;

		const body = buildConsentBody();
		logger.info(`Creating consent with body:`, body);
		logger.info(`Original roles from toolMessage:`, toolMessage.consentRequiredRoles);

		try {
			const response = await fetch('/backend/opey/consent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				let errorData: any = {};
				try { errorData = await response.json(); } catch { /* non-JSON body */ }
				const errMsg = errorData.error || errorData.message || `Failed to create consent (HTTP ${response.status})`;
				if (isDev) {
					debugResponse = { status: response.status, error: errMsg };
					console.groupCollapsed(`%c[Consent Debug] ✗ ${toolMessage.toolName} — HTTP ${response.status}`, 'color:#dc2626');
					console.log('toolMessage:', toolMessage);
					console.log('POST body sent:', body);
					console.log('Response:', errorData);
					console.groupEnd();
				}
				throw new Error(errMsg);
			}

			const data = await response.json();
			if (!data.consent_jwt) {
				throw new Error('No consent JWT returned from server');
			}

			if (isDev) {
				const decoded = decodeJwtPayload(data.consent_jwt);
				debugResponse = { status: 200, consent_jwt: data.consent_jwt, decodedJwt: decoded };
				console.groupCollapsed(`%c[Consent Debug] ✓ ${toolMessage.toolName} — 200`, 'color:#059669');
				console.log('toolMessage:', toolMessage);
				console.log('POST body sent:', body);
				console.log('Response:', data);
				console.log('Decoded JWT payload:', decoded);
				console.groupEnd();
			}

			logger.info(`Consent created successfully for tool ${toolMessage.toolCallId}`);
			await onConsent(toolMessage.toolCallId, data.consent_jwt);
		} catch (error) {
			logger.error('Failed to create consent:', error);
			consentError = error instanceof Error ? error.message : 'Failed to create consent';
		} finally {
			isProcessing = false;
		}
	}

	async function handleDenyConsent() {
		if (isProcessing) return;
		isProcessing = true;
		consentError = null;

		try {
			await onDeny(toolMessage.toolCallId);
		} finally {
			isProcessing = false;
		}
	}
</script>

<div class="card rounded-lg border border-tertiary-500/60 px-3 py-2.5 bg-tertiary-50-950/10">
	<!-- Header row: icon + title + tool/operation context -->
	<div class="mb-1.5 flex items-center gap-2">
		<KeyRound class="text-tertiary-600 dark:text-tertiary-400 flex-shrink-0" size={16} />
		<span class="text-sm font-semibold">Consent Required</span>
		<code class="ml-auto rounded bg-primary-100 px-1.5 py-0.5 text-xs dark:bg-primary-800">{toolMessage.toolName}</code>
	</div>

	<!-- Brief explanation -->
	<p class="mb-2 text-xs text-surface-600 dark:text-surface-400">
		{#if (toolMessage.consentToolCallCount ?? 1) > 1}
			<strong>{toolMessage.consentToolCallCount} calls</strong> need a temporary consent (1 hr).
		{:else}
			Grant a temporary consent (1 hr) for this action.
		{/if}
		{#if toolMessage.consentRequiresViewAccess && (!toolMessage.consentRequiredRoles || toolMessage.consentRequiredRoles.length === 0)}
			This endpoint uses account-access-to-a-view (no system role required).
		{:else if toolMessage.consentIsUserScoped && (!toolMessage.consentRequiredRoles || toolMessage.consentRequiredRoles.length === 0)}
			This is a user-scoped endpoint — it returns data tied to your identity.
		{/if}
	</p>

	<!-- Account / View / User-scope chips -->
	{#if toolMessage.consentAccountId || toolMessage.consentViewId || toolMessage.consentIsUserScoped}
		<div class="mb-2 flex flex-wrap items-center gap-1">
			{#if toolMessage.consentIsUserScoped}
				<span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800" title="Identity-bound endpoint">
					<User size={10} />
					User-scoped
				</span>
			{/if}
			{#if toolMessage.consentAccountId}
				<span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800" title="Account ID">
					<CreditCard size={10} />
					Account: <code class="font-mono">{toolMessage.consentAccountId}</code>
				</span>
			{/if}
			{#if toolMessage.consentViewId}
				<span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800" title="View ID">
					<Eye size={10} />
					View: <code class="font-mono">{toolMessage.consentViewId}</code>
				</span>
			{/if}
		</div>
	{/if}

	<!-- Required Roles (inline chips) -->
	{#if toolMessage.consentRequiredRoles && toolMessage.consentRequiredRoles.length > 0}
		{@const rawRoles = (toolMessage.consentRequiredRoles || []).map((r: any) =>
			typeof r === 'string' ? r : (r?.role || r?.role_name || r?.name || JSON.stringify(r))
		)}
		{@const roleRequirements = expandRoleRequirements(deduplicateRoles(rawRoles))}
		<div class="mb-2 flex flex-wrap items-center gap-1">
			{#each roleRequirements as req}
				<span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800">
					<Shield size={10} />
					{req.role}
				</span>
				{#if req.alternatives.length > 0}
					<span class="text-[11px] text-surface-500">or</span>
					{#each req.alternatives as alt}
						<span class="inline-flex items-center gap-1 rounded-full border border-tertiary-300 px-2 py-0.5 text-[11px] font-medium text-surface-600 dark:border-tertiary-600 dark:text-surface-400">
							<Shield size={10} />
							{alt}
						</span>
					{/each}
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Error Display -->
	{#if consentError}
		<div class="mb-2 rounded bg-error-50 px-2 py-1.5 text-xs text-error-700 dark:bg-error-900/30 dark:text-error-300">
			{consentError}
		</div>
	{/if}

	<!-- Dev-only debug surface: what Opey asked for, what we'd POST, what came back -->
	{#if isDev}
		<details class="mb-2 rounded border border-surface-300 dark:border-surface-700" data-testid="consent-debug">
			<summary class="cursor-pointer px-2 py-1 text-[11px] text-surface-600 dark:text-surface-400">
				🐞 Debug
			</summary>
			<div class="space-y-2 border-t border-surface-300 px-2 py-2 text-[11px] dark:border-surface-700">
				<div>
					<div class="font-semibold">consent_request event from Opey</div>
					<pre class="overflow-auto rounded bg-surface-100 p-1 font-mono dark:bg-surface-900" data-testid="consent-debug-asked">{JSON.stringify({
						toolName: toolMessage.toolName,
						toolCallId: toolMessage.toolCallId,
						consentRequiredRoles: toolMessage.consentRequiredRoles,
						consentBankId: toolMessage.consentBankId,
						consentAccountId: toolMessage.consentAccountId,
						consentViewId: toolMessage.consentViewId,
						consentRequiresViewAccess: toolMessage.consentRequiresViewAccess,
						consentIsUserScoped: toolMessage.consentIsUserScoped,
						consentToolCallCount: toolMessage.consentToolCallCount
					}, null, 2)}</pre>
				</div>
				<div>
					<div class="font-semibold">POST /backend/opey/consent body</div>
					<pre class="overflow-auto rounded bg-surface-100 p-1 font-mono dark:bg-surface-900" data-testid="consent-debug-body">{JSON.stringify(buildConsentBody(), null, 2)}</pre>
				</div>
				{#if debugResponse}
					<div>
						<div class="font-semibold">Response — HTTP {debugResponse.status}</div>
						{#if debugResponse.error}
							<pre class="overflow-auto rounded bg-error-50 p-1 font-mono text-error-700 dark:bg-error-900/30 dark:text-error-300" data-testid="consent-debug-response-error">{debugResponse.error}</pre>
						{/if}
						{#if debugResponse.decodedJwt}
							<div class="mt-1 text-surface-500">Decoded consent JWT payload:</div>
							<pre class="overflow-auto rounded bg-surface-100 p-1 font-mono dark:bg-surface-900" data-testid="consent-debug-response-jwt">{JSON.stringify(debugResponse.decodedJwt, null, 2)}</pre>
						{/if}
					</div>
				{/if}
			</div>
		</details>
	{/if}

	<!-- Safeguard: this consent_request needs view scope but none is available yet -->
	{#if promptForScope}
		<div
			class="mb-2 rounded border border-warning-500/50 bg-warning-50 px-2 py-2 text-xs dark:bg-warning-900/20"
			data-testid="consent-needs-scope"
		>
			<p class="mb-2 text-warning-800 dark:text-warning-200">
				This action needs view access to at least one account, but you haven't
				selected any in the <strong>Working accounts</strong> picker below the chat.
				Pick the account(s) and view(s) you'd like Opey to see, then click Grant.
			</p>
			<button
				type="button"
				class="btn btn-sm preset-filled-warning-500"
				onclick={focusAccountScopePicker}
				data-testid="open-account-scope-picker-from-consent"
			>
				Open account picker
			</button>
		</div>
	{/if}

	<!-- Action Buttons -->
	<div class="flex gap-2">
		<button
			class="btn btn-sm flex-1 preset-filled-tertiary-500"
			onclick={handleGrantConsent}
			disabled={isProcessing || promptForScope}
			data-testid="consent-grant-button"
		>
			{#if isProcessing}
				<Loader2 size={14} class="animate-spin" />
				<span>Granting...</span>
			{:else}
				<CheckCircle size={14} />
				<span>Grant</span>
			{/if}
		</button>
		<button
			class="btn btn-sm preset-outlined-error-500"
			onclick={handleDenyConsent}
			disabled={isProcessing}
		>
			<XCircle size={14} />
			<span>Deny</span>
		</button>
	</div>
</div>
