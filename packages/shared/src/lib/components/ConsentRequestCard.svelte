<script lang="ts">
	import type { ToolMessage } from '$lib/opey/types';
	import { createLogger } from '$lib/utils/logger';
	import { Shield, CheckCircle, XCircle, KeyRound, Loader2 } from '@lucide/svelte';
	import { expandRoleRequirements, deduplicateRoles } from '$lib/opey/utils/roles';

	const logger = createLogger('ConsentRequestCard');

	interface Props {
		toolMessage: ToolMessage;
		onConsent: (toolCallId: string, consentJwt: string) => Promise<void>;
		onDeny: (toolCallId: string) => Promise<void>;
	}

	let { toolMessage, onConsent, onDeny }: Props = $props();

	let isProcessing = $state(false);
	let consentError = $state<string | null>(null);

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

	/**
	 * Create a role-specific consent via the server-side API route,
	 * then pass the JWT back to the chat controller.
	 */
	async function handleGrantConsent() {
		if (isProcessing) return;
		isProcessing = true;
		consentError = null;

		try {
			// Normalize roles to strings (handle both string and object formats)
			const normalizedRoles = deduplicateRoles(
				(toolMessage.consentRequiredRoles || []).map((role: any) => {
					if (typeof role === 'string') return role;
					// Handle object format: {role: "CanCreateBank", requires_bank_id: false}
					return role?.role || role?.role_name || role?.name || '';
				}).filter(Boolean)
			);

			const bankId = resolveBankId();
			logger.info(`Creating consent with roles:`, normalizedRoles, `bank_id:`, bankId);
			logger.info(`Original roles from toolMessage:`, toolMessage.consentRequiredRoles);

			// Call our server-side API to create the consent at OBP
			const response = await fetch('/api/opey/consent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					required_roles: normalizedRoles,
					bank_id: bankId
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Failed to create consent (HTTP ${response.status})`);
			}

			const data = await response.json();

			if (!data.consent_jwt) {
				throw new Error('No consent JWT returned from server');
			}

			logger.info(`Consent created successfully for tool ${toolMessage.toolCallId}`);

			// Send the JWT back to the chat controller
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
	</p>

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

	<!-- Action Buttons -->
	<div class="flex gap-2">
		<button
			class="btn btn-sm flex-1 preset-filled-tertiary-500"
			onclick={handleGrantConsent}
			disabled={isProcessing}
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
