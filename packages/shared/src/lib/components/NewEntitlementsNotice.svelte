<script lang="ts">
	import { KeyRound, ShieldCheck, X } from '@lucide/svelte';
	import { createLogger } from '$shared/utils/logger';
	import {
		activeConsents,
		consentsCover,
		type GrantedConsentSummary
	} from '$shared/opey/utils/consentSummary';
	import { CONSENT_FORBIDDEN_ROLES } from '$shared/opey/utils/roles';

	const logger = createLogger('NewEntitlementsNotice');

	interface EntitlementPair {
		role_name: string;
		/** Empty string for system-wide entitlements. */
		bank_id: string;
	}

	interface Props {
		/**
		 * Browser-reachable endpoint returning the OBP /my/entitlements shape
		 * ({ list: [{ role_name, bank_id }, ...] }). Both apps serve the generic
		 * authenticated proxy at /proxy/obp/..., so the default works everywhere.
		 */
		entitlementsUrl?: string;
		/**
		 * Re-check signal: any change re-fetches (debounced) and diffs against the
		 * baseline. OpeyChat passes the count of successfully completed tool calls,
		 * since those are what can grant the user new entitlements mid-session
		 * (e.g. creating a bank auto-grants CanCreateEntitlementAtOneBank there).
		 */
		refreshTrigger?: number;
		/** Fetch only when the user is authenticated. */
		enabled?: boolean;
		/**
		 * Consents Opey has been granted in this chat (decoded JWT summaries).
		 * Shown beside the notice so the user sees what each frozen consent can
		 * actually do — and that the new entitlement is not in any of them.
		 */
		consents?: GrantedConsentSummary[];
		/** Metrics page accepting ?consent_reference_id=...; links the reference id when set. */
		consentMetricsHref?: string;
	}

	let {
		entitlementsUrl = '/proxy/obp/v5.1.0/my/entitlements',
		refreshTrigger = 0,
		enabled = false,
		consents = [],
		consentMetricsHref
	}: Props = $props();

	// Only the consent Opey is using right now (the most recent live grant).
	let currentConsent = $derived.by(() => {
		const live = activeConsents(consents);
		return live.length > 0 ? live[live.length - 1] : null;
	});

	function formatTime(ms: number | null): string {
		if (ms === null) return 'unknown';
		return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// (role_name, bank_id) pairs already seen this session. null until the
	// baseline snapshot has loaded — additions are only meaningful after that.
	let known: Set<string> | null = null;
	let newEntitlements: EntitlementPair[] = $state([]);
	// New entitlements no live consent embeds — normally all of them, since a
	// consent is a snapshot taken at mint time. Anything covered is filtered out.
	let uncovered = $derived(
		newEntitlements.filter((e) => !consentsCover(currentConsent ? [currentConsent] : [], e))
	);

	const keyOf = (e: EntitlementPair) => `${e.role_name}|${e.bank_id ?? ''}`;

	async function fetchEntitlements(): Promise<EntitlementPair[] | null> {
		try {
			const res = await fetch(entitlementsUrl, { headers: { Accept: 'application/json' } });
			if (!res.ok) {
				logger.debug(`Entitlements fetch failed: HTTP ${res.status}`);
				return null;
			}
			const data = await res.json();
			if (!Array.isArray(data?.list)) return null;
			return data.list
				.filter((e: any) => e && typeof e.role_name === 'string')
				.map((e: any) => ({ role_name: e.role_name, bank_id: e.bank_id ?? '' }));
		} catch (error) {
			logger.debug('Entitlements fetch failed:', error);
			return null;
		}
	}

	async function check() {
		const list = await fetchEntitlements();
		if (!list) return; // transient failure — try again on the next trigger
		if (known === null) {
			known = new Set(list.map(keyOf));
			return;
		}
		const additions = list.filter((e) => !known!.has(keyOf(e)));
		if (additions.length > 0) {
			for (const a of additions) known.add(keyOf(a));
			newEntitlements = [...newEntitlements, ...additions];
			logger.info(
				'User gained entitlements mid-session:',
				additions.map((a) => `${a.role_name}@${a.bank_id || '(system)'}`)
			);
		}
	}

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		void refreshTrigger; // re-run when the trigger changes
		if (!enabled) return;
		// Debounce: several tool calls can complete in quick succession; one
		// fetch after the burst is enough (the diff is cumulative anyway).
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(check, 400);
		return () => clearTimeout(debounceTimer);
	});

	function dismiss() {
		newEntitlements = [];
	}
</script>

{#if newEntitlements.length > 0}
	<div
		class="mb-2 flex items-stretch gap-2 text-sm"
		role="status"
		aria-live="polite"
		data-testid="new-entitlements-notice"
	>
		<div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
			<!-- Left: what the human gained -->
			<div class="flex items-start gap-3 rounded-md border border-success-500 bg-success-50-950 p-3">
				<KeyRound class="mt-0.5 h-4 w-4 flex-shrink-0 text-success-700-300" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<p class="font-semibold">
						You gained {newEntitlements.length === 1 ? 'a new entitlement' : `${newEntitlements.length} new entitlements`} during this chat
					</p>
					<ul class="mt-1 space-y-0.5">
						{#each newEntitlements as e (keyOf(e))}
							<li data-testid="new-entitlement-{e.role_name}-{e.bank_id || 'system'}">
								<code class="font-mono text-xs">{e.role_name}</code>
								{#if e.bank_id}
									<span class="opacity-70">at bank</span>
									<code class="font-mono text-xs">{e.bank_id}</code>
								{:else}
									<span class="opacity-70">(system-wide)</span>
								{/if}
							</li>
						{/each}
					</ul>
					{#if newEntitlements.some((e) => CONSENT_FORBIDDEN_ROLES.includes(e.role_name))}
						<p class="mt-1 text-xs opacity-70" data-testid="new-entitlements-granting-hint">
							This is the system-wide role-granting role. OBP never lets a consent carry it,
							so Opey can't use it — grant yourself the bank-scoped
							<code class="font-mono text-xs">CanCreateEntitlementAtOneBank</code> on the
							<a href="/user/entitlements" class="text-tertiary-600-400 hover:underline"
								>Entitlements page</a
							>
							and Opey can grant roles at that bank for you.
						</p>
					{:else}
						<p class="mt-1 text-xs opacity-70">
							Existing consents don't include these — if an action just failed for missing
							permissions, retry it and grant the new consent when prompted.
							<a href="/user/entitlements" class="text-tertiary-600-400 hover:underline"
								>View all entitlements →</a
							>
						</p>
					{/if}
				</div>
			</div>

			<!-- Right: what Opey's current consent can actually do -->
			<div
				class="flex items-start gap-3 rounded-md border border-tertiary-500 bg-tertiary-50-950 p-3"
				data-testid="opey-consent-power"
			>
				<ShieldCheck class="mt-0.5 h-4 w-4 flex-shrink-0 text-tertiary-700-300" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<p class="font-semibold">
						{#if currentConsent}
							What Opey can do with its current consent
						{:else}
							Opey holds no consent yet in this chat
						{/if}
					</p>
					{#if !currentConsent}
						<p class="mt-1 text-xs opacity-70">
							The next action will ask you to grant one, and it will be minted from your
							current entitlements — including the new {newEntitlements.length === 1 ? 'one' : 'ones'} above.
						</p>
					{:else}
						<div class="mt-1 space-y-0.5" data-testid="opey-current-consent">
							<div>
								<span class="opacity-70">consent_reference_id</span>
								{#if currentConsent.referenceId && consentMetricsHref}
									<a
										href={`${consentMetricsHref}?consent_reference_id=${encodeURIComponent(currentConsent.referenceId)}`}
										class="text-tertiary-600-400 hover:underline"
										><code class="font-mono text-xs">{currentConsent.referenceId}</code></a
									>
								{:else}
									<code class="font-mono text-xs" data-testid="opey-current-consent-reference-id"
										>{currentConsent.referenceId ?? 'resolving…'}</code
									>
								{/if}
							</div>
							{#each currentConsent.entitlements as e (`${e.role_name}|${e.bank_id}`)}
								<div>
									<code class="font-mono text-xs">{e.role_name}</code>
									{#if e.bank_id}
										<span class="opacity-70">at bank</span>
										<code class="font-mono text-xs">{e.bank_id}</code>
									{:else}
										<span class="opacity-70">(system-wide)</span>
									{/if}
								</div>
							{/each}
							{#each currentConsent.views as v (`${v.bank_id}|${v.account_id}|${v.view_id}`)}
								<div>
									<span class="opacity-70">view</span>
									<code class="font-mono text-xs">{v.view_id}</code>
									<span class="opacity-70">on</span>
									<code class="font-mono text-xs">{v.bank_id}/{v.account_id}</code>
								</div>
							{/each}
							{#if currentConsent.entitlements.length === 0 && currentConsent.views.length === 0}
								<div class="text-xs opacity-70">Identity only — no roles or views</div>
							{/if}
							<div class="text-xs opacity-70">expires {formatTime(currentConsent.expiresAt)}</div>
						</div>
						{#if uncovered.length > 0}
							<p class="mt-1 text-xs opacity-70" data-testid="opey-consent-gap">
								A consent is a snapshot taken when it's granted, so {uncovered.length === 1 ? 'the new entitlement above is' : 'the new entitlements above are'}
								not in it. Opey can only use {uncovered.length === 1 ? 'it' : 'them'} once you grant a fresh consent.
							</p>
						{/if}
					{/if}
				</div>
			</div>
		</div>
		<button
			type="button"
			class="flex-shrink-0 self-start opacity-60 hover:opacity-100"
			onclick={dismiss}
			aria-label="Dismiss new entitlements notice"
			data-testid="new-entitlements-dismiss"
		>
			<X class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
{/if}
