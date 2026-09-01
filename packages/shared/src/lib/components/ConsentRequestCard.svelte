<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ToolMessage } from '$shared/opey/types';
	import { createLogger } from '$shared/utils/logger';
	import { Shield, CheckCircle, XCircle, KeyRound, Loader2, Eye, CreditCard, User } from '@lucide/svelte';
	import {
		narrowestRoles,
		selectConsentEntitlements,
		forbiddenConsentRoles,
		type StoredEntitlement
	} from '$shared/opey/utils/roles';
	import { getSelectedConsentViews, type ConsentViewSelection } from '$shared/opey/utils/consentScope';

	const logger = createLogger('ConsentRequestCard');

	interface Props {
		toolMessage: ToolMessage;
		onConsent: (toolCallId: string, consentJwt: string) => Promise<void>;
		onDeny: (toolCallId: string, reason?: string) => Promise<void>;
	}

	let { toolMessage, onConsent, onDeny }: Props = $props();

	let isProcessing = $state(false);
	let consentError = $state<string | null>(null);

	// The user's stored (role_name, bank_id) pairs, fetched once via the generic OBP
	// proxy so the card can preview EXACTLY which pairs the consent will embed —
	// the same selection the endpoint makes — instead of listing every alternative
	// Opey reported. null until loaded (or if the fetch fails): then the chips fall
	// back to the narrowest role names.
	let userEntitlements = $state<StoredEntitlement[] | null>(null);
	async function loadUserEntitlements() {
		try {
			const res = await fetch('/proxy/obp/v5.1.0/my/entitlements', { headers: { Accept: 'application/json' } });
			if (!res.ok) return;
			const data = await res.json();
			if (!Array.isArray(data?.list)) return;
			userEntitlements = data.list
				.filter((e: any) => e && typeof e.role_name === 'string')
				.map((e: any) => ({ role_name: e.role_name, bank_id: e.bank_id ?? '' }));
		} catch (error) {
			logger.debug('Entitlements preview fetch failed:', error);
		}
	}

	// Role names as Opey reported them (strings or {role, requires_bank_id} objects).
	let rawRoleNames = $derived(
		((toolMessage.consentRequiredRoles || []) as any[])
			.map((r) => (typeof r === 'string' ? r : r?.role || r?.role_name || r?.name || ''))
			.filter(Boolean) as string[]
	);
	// Bank-scoping per role, from the consent_required payload; unknown otherwise.
	let requiresBankIdOf = $derived.by(() => {
		const m = new Map<string, boolean>();
		for (const r of (toolMessage.consentRequiredRoles || []) as any[]) {
			if (typeof r === 'object' && r && typeof r.requires_bank_id === 'boolean') {
				m.set(r.role || r.role_name || r.name, r.requires_bank_id);
			}
		}
		return (role: string) => m.get(role);
	});
	// Illogical request: EVERY role Opey wants is one OBP never allows in a consent
	// (the system-wide granting role, OBP-35033). When it is merely one alternative
	// beside the bank-scoped role this is fine — the bank-scoped pair gets embedded.
	// No amount of granting can make the all-forbidden case work, so say so up
	// front, block Grant, and let the user send the reason to Opey with one click.
	let forbiddenRoles = $derived(forbiddenConsentRoles(rawRoleNames));
	let illogicalReason = $derived(
		rawRoleNames.length > 0 && forbiddenRoles.length === new Set(rawRoleNames).size
			? `OBP does not allow ${forbiddenRoles.join(' or ')} in a consent (OBP-35033), so no consent can authorise this call for Opey. Use the bank-scoped role instead, or do this yourself with your own session.`
			: null
	);

	// What the consent WILL carry (and what it can't), or null before entitlements load.
	let embedPreview = $derived(
		userEntitlements
			? selectConsentEntitlements(rawRoleNames, resolveBankId() ?? '', userEntitlements, requiresBankIdOf)
			: null
	);

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
		void loadUserEntitlements();
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
	 * Priority: explicit consentBankId from backend > toolInput path_params >
	 * toolInput body / query params (e.g. addEntitlement carries bank_id in the body).
	 * Getting this wrong scopes the consent to the wrong bank, and OBP then rejects
	 * the call with a role error even though the user holds the role.
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

		// 4. Extract from the request body or query params — some endpoints
		// (e.g. Add Entitlement) take the target bank there, not in the path.
		const bodyBankId = toolMessage.toolInput?.body?.bank_id;
		if (typeof bodyBankId === 'string' && bodyBankId) return bodyBankId;
		const queryBankId = toolMessage.toolInput?.query_params?.bank_id;
		if (typeof queryBankId === 'string' && queryBankId) return queryBankId;

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
		// Send EVERY role Opey reported, uncollapsed. A superseding chain in the list
		// (e.g. CanCreateEntitlementAtOneBank | CanCreateEntitlementAtAnyBank) is OBP's
		// "X or Y"; the consent endpoint picks whichever the user actually holds.
		// Collapsing here to the broader role used to make the mint demand a role a
		// bank creator never has.
		const normalizedRoles = Array.from(
			new Set(
				(toolMessage.consentRequiredRoles || [])
					.map((role: any) => {
						if (typeof role === 'string') return role;
						// Handle object format: {role: "CanCreateBank", requires_bank_id: false}
						return role?.role || role?.role_name || role?.name || '';
					})
					.filter(Boolean) as string[]
			)
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
				if (response.status === 403) {
					// Roles unsatisfiable — retrying the Grant cannot succeed. Resolve the
					// interrupt now with the reason so the agent learns WHY and can propose
					// the fix (e.g. granting the missing entitlement) instead of just
					// seeing "user denied consent".
					consentError = errMsg;
					await onDeny(toolMessage.toolCallId, errMsg);
					return;
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

		try {
			// If a Grant already failed, forward that failure as the denial reason so
			// the agent knows why instead of just "user denied consent".
			await onDeny(toolMessage.toolCallId, illogicalReason ?? consentError ?? undefined);
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

	<!-- Roles: the exact pairs this consent will embed (preview from the user's own
	     entitlements), or the narrowest required role names until those load. -->
	{#if rawRoleNames.length > 0}
		<div class="mb-2 flex flex-wrap items-center gap-1" data-testid="consent-role-chips">
			{#if embedPreview}
				{#each embedPreview.entitlements as e (`${e.role_name}|${e.bank_id}`)}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800"
						data-testid="consent-role-chip"
					>
						<Shield size={10} />
						{e.role_name}
						{#if e.bank_id}
							<span class="font-mono opacity-60">@ {e.bank_id}</span>
						{:else}
							<span class="opacity-60">(system-wide)</span>
						{/if}
					</span>
				{/each}
				{#each embedPreview.unsatisfiable as label (label)}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-warning-500 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:text-warning-300"
						data-testid="consent-role-chip-missing"
					>
						<Shield size={10} />
						not held: {label}
					</span>
				{/each}
			{:else}
				{#each narrowestRoles(rawRoleNames) as role (role)}
					<span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-[11px] font-medium dark:bg-tertiary-800">
						<Shield size={10} />
						{role}
					</span>
				{/each}
			{/if}
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

	<!-- Illogical request: a role OBP never allows in a consent -->
	{#if illogicalReason}
		<div
			class="mb-2 rounded border border-error-500/60 bg-error-50 px-2 py-2 text-xs dark:bg-error-900/20"
			role="alert"
			data-testid="consent-illogical"
		>
			<p class="mb-1 font-semibold text-error-800 dark:text-error-200">This consent can't be granted</p>
			<p class="mb-2 text-error-800 dark:text-error-200">
				{#each forbiddenRoles as r (r)}<code class="font-mono">{r}</code>{' '}{/each}
				is the system-wide role-granting role. OBP never lets a consent carry it
				(OBP-35033), so no consent can authorise this call for Opey. Opey can act with
				the bank-scoped <code class="font-mono">CanCreateEntitlementAtOneBank</code> instead,
				or do this yourself on the
				<a href="/user/entitlements" class="underline">Entitlements page</a>. Use
				<strong>Tell Opey</strong> so it stops trying.
			</p>
		</div>
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
			disabled={isProcessing || promptForScope || !!illogicalReason}
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
			class="btn btn-sm {illogicalReason ? 'flex-1 preset-filled-error-500' : 'preset-outlined-error-500'}"
			onclick={handleDenyConsent}
			disabled={isProcessing}
			data-testid="consent-deny-button"
		>
			<XCircle size={14} />
			<span>{illogicalReason ? 'Tell Opey' : 'Deny'}</span>
		</button>
	</div>
</div>
