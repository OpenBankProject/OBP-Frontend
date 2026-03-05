<script lang="ts">
    import type { ToolMessage } from '$lib/opey/types';
    import { ToolError, ObpApiResponse, DefaultToolResponse } from '.';
    import {
        Check,
        LoaderCircle,
        XCircle,
        AlertTriangle,
        CheckCircle,
        ChevronDown,
        ChevronUp,
    } from '@lucide/svelte';
	import ToolApprovalCard from '../ToolApprovalCard.svelte';
	import ConsentRequestCard from '../ConsentRequestCard.svelte';
	    interface Props {
        message: ToolMessage;
        onApprove?: (toolCallId: string, approvalLevel?: string) => Promise<void>;
        onDeny?: (toolCallId: string) => Promise<void>;
        batchApprovalGroup?: ToolMessage[];  // Other tools in the same batch
        onBatchSubmit?: (decisions: Map<string, { approved: boolean; level: string }>) => Promise<void>;
        onConsent?: (toolCallId: string, consentJwt: string) => Promise<void>;
        onConsentDeny?: (toolCallId: string) => Promise<void>;
    }
    
    let { message, onApprove, onDeny, batchApprovalGroup, onBatchSubmit, onConsent, onConsentDeny }: Props = $props();
    
    // Check if this is part of a batch approval
    let isBatchApproval = $derived(!!batchApprovalGroup && batchApprovalGroup.length > 1);
    
    // Track batch decisions (only used if this is the first message in batch)
    let batchDecisions = $state(
        batchApprovalGroup
            ? new Map(
                batchApprovalGroup.map(tm => [
                    tm.toolCallId,
                    { approved: false, level: tm.defaultApprovalLevel || 'once' }
                ])
            )
            : new Map()
    );
    
    let isFirstInBatch = $derived(
        isBatchApproval && batchApprovalGroup?.[0]?.toolCallId === message.toolCallId
    );
    
    // Helper function for tool display names
    function getToolDisplayName(toolName: string): string {
        switch (toolName) {
            case 'retrieve_endpoints':
                return 'Endpoint Retrieval';
            case 'retrieve_glossary':
                return 'Glossary Retrieval';
            case 'list_endpoints_by_tag':
                return 'List Endpoints by Tag';
            case 'obp_requests':
                return 'OBP API Request';
            default:
                return toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    }
    
    let isProcessing = $state(false);
    
    // Track expanded state - default collapsed unless waiting for approval/consent or error
    let manualToggle = $state<boolean | null>(null);
    let isExpanded = $derived(
        manualToggle ?? (
            message.waitingForApproval ||
            message.waitingForConsent ||
            message.status === 'error'
        )
    );
    
    // Individual approval handlers
    async function handleApprove(toolCallId: string, approvalLevel?: string) {
        if (isProcessing || message.approvalStatus === 'approved') return;
        isProcessing = true;
        try {
            if (isBatchApproval) {
                // Update batch decision
                const level = approvalLevel || message.defaultApprovalLevel || 'once';
                batchDecisions.set(toolCallId, { approved: true, level });
                batchDecisions = new Map(batchDecisions);
            } else if (onApprove) {
                await onApprove(toolCallId, approvalLevel);
            }
        } finally {
            isProcessing = false;
        }
    }
    
    async function handleDeny(toolCallId: string) {
        if (isProcessing || message.approvalStatus === 'denied') return;
        isProcessing = true;
        try {
            if (isBatchApproval) {
                // Update batch decision
                batchDecisions.set(toolCallId, { approved: false, level: 'once' });
                batchDecisions = new Map(batchDecisions);
            } else if (onDeny) {
                await onDeny(toolCallId);
            }
        } finally {
            isProcessing = false;
        }
    }
    
    // Batch approval bulk actions
    function approveAll() {
        batchApprovalGroup?.forEach(tm => {
            batchDecisions.set(tm.toolCallId, { approved: true, level: tm.defaultApprovalLevel || 'once' });
        });
        batchDecisions = new Map(batchDecisions);
    }
    
    function denyAll() {
        batchApprovalGroup?.forEach(tm => {
            batchDecisions.set(tm.toolCallId, { approved: false, level: 'once' });
        });
        batchDecisions = new Map(batchDecisions);
    }
    
    function approveSafe() {
        batchApprovalGroup?.forEach(tm => {
            if (tm.riskLevel === 'low') {
                batchDecisions.set(tm.toolCallId, { approved: true, level: 'session' });
            }
        });
        batchDecisions = new Map(batchDecisions);
    }
    
    async function handleBatchSubmit() {
        if (isProcessing || !onBatchSubmit) return;
        isProcessing = true;
        try {
            await onBatchSubmit(batchDecisions);
        } finally {
            isProcessing = false;
        }
    }
    
    // Count batch decisions
    let approvedCount = $derived(
        Array.from(batchDecisions.values()).filter(d => d.approved).length
    );
    let deniedCount = $derived(
        batchApprovalGroup ? batchApprovalGroup.length - approvedCount : 0
    );
    let allDecisionsMade = $derived(
        batchApprovalGroup?.every(tm => {
            const decision = batchDecisions.get(tm.toolCallId);
            return decision && (decision.approved || !decision.approved);
        }) ?? false
    );
    
    // Determine if approval UI should be shown
    let showApprovalInterface = $derived(
        message.waitingForApproval && 
        message.approvalStatus !== 'approved' && 
        message.approvalStatus !== 'denied'
    );

    // Determine if consent UI should be shown
    let showConsentInterface = $derived(
        message.waitingForConsent && 
        message.consentStatus === 'pending'
    );
    
    // Determine status display
    let statusDisplay = $derived.by(() => {
        if (message.status === 'error') return 'Error';
        if (message.approvalStatus === 'denied') return 'Denied';
        if (message.consentStatus === 'denied') return 'Consent Denied';
        if (message.waitingForConsent) return 'Awaiting Consent';
        if (message.waitingForApproval) return 'Awaiting Approval';
        if (message.isStreaming) return 'Executing...';
        if (message.toolOutput) return 'Complete';
        return 'Pending';
    });
    
    let statusIcon = $derived.by(() => {
        if (message.status === 'error') return XCircle;
        if (message.approvalStatus === 'denied') return XCircle;
        if (message.consentStatus === 'denied') return XCircle;
        if (message.waitingForConsent) return AlertTriangle;
        if (message.waitingForApproval) return AlertTriangle;
        if (message.isStreaming) return LoaderCircle;
        if (message.toolOutput) return CheckCircle;
        return LoaderCircle;
    });
    
    let statusColorClass = $derived.by(() => {
        if (message.status === 'error') return 'text-error-600-400';
        if (message.approvalStatus === 'denied') return 'text-error-600-400';
        if (message.consentStatus === 'denied') return 'text-error-600-400';
        if (message.waitingForConsent) return 'text-tertiary-600-400';
        if (message.waitingForApproval) return 'text-warning-600-400';
        if (message.isStreaming) return 'text-warning-600-400';
        if (message.toolOutput) return 'text-success-600-400';
        return 'text-surface-600-400';
    });

    let shouldSpin = $derived(message.isStreaming && !message.waitingForApproval && !message.waitingForConsent);

    let borderColorClass = $derived.by(() => {
        if (message.status === 'error') return 'border-error-500';
        if (message.approvalStatus === 'denied') return 'border-error-500';
        if (message.consentStatus === 'denied') return 'border-error-500';
        if (message.waitingForConsent) return 'border-tertiary-500';
        if (message.waitingForApproval) return 'border-warning-500';
        return 'border-surface-300-700';
    });

</script>

{#if isBatchApproval && isFirstInBatch}
    <!-- Batch Approval View -->
    <div class="card variant-ghost-warning rounded-lg border-2 border-warning-500 p-4 space-y-4 text-left">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <AlertTriangle class="text-warning-600" size={24} />
                <div>
                    <h3 class="text-lg font-semibold">Multiple Approvals Required</h3>
                    <p class="text-sm text-surface-600-400">
                        {batchApprovalGroup?.length || 0} operations pending approval
                    </p>
                </div>
            </div>
            <div class="flex gap-2 text-sm">
                <span class="rounded-full bg-success-100 px-3 py-1 dark:bg-success-900">
                    ✓ {approvedCount}
                </span>
                <span class="rounded-full bg-error-100 px-3 py-1 dark:bg-error-900">
                    ✗ {deniedCount}
                </span>
            </div>
        </div>

        <!-- Bulk Actions -->
        <div class="flex gap-2">
            <button class="btn variant-filled-success btn-sm" onclick={approveAll}>
                <CheckCircle size={16} />
                Approve All
            </button>
            <button class="btn variant-filled-error btn-sm" onclick={denyAll}>
                <XCircle size={16} />
                Deny All
            </button>
            <button class="btn variant-filled-primary btn-sm" onclick={approveSafe}>
                <Check size={16} />
                Approve Low-Risk
            </button>
        </div>

        <!-- Individual Approvals -->
        <div class="space-y-3">
            {#each batchApprovalGroup || [] as toolMsg (toolMsg.toolCallId)}
                {@const decision = batchDecisions.get(toolMsg.toolCallId)}
                {@const hasDecision = decision && (decision.approved !== undefined)}
                
                {#if !hasDecision}
                    <!-- Pending approval -->
                    <ToolApprovalCard
                        toolMessage={toolMsg}
                        onApprove={handleApprove}
                        onDeny={handleDeny}
                    />
                {:else if decision.approved}
                    <!-- Approved -->
                    <div class="card variant-ghost-success rounded-lg border-2 border-success-500 p-3">
                        <div class="flex items-center gap-3">
                            <CheckCircle class="text-success-600" size={20} />
                            <div class="flex-1">
                                <div class="font-semibold text-sm">{toolMsg.toolName}</div>
                                <div class="text-xs text-surface-600-400">
                                    Approved ({decision.level})
                                </div>
                            </div>
                        </div>
                    </div>
                {:else}
                    <!-- Denied -->
                    <div class="card variant-ghost-error rounded-lg border-2 border-error-500 p-3">
                        <div class="flex items-center gap-3">
                            <XCircle class="text-error-600" size={20} />
                            <div class="flex-1">
                                <div class="font-semibold text-sm">{toolMsg.toolName}</div>
                                <div class="text-xs text-surface-600-400">
                                    Denied
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end">
            <button
                class="btn variant-filled-primary"
                onclick={handleBatchSubmit}
                disabled={!allDecisionsMade || isProcessing}
            >
                {#if isProcessing}
                    <span class="animate-pulse">Submitting...</span>
                {:else if !allDecisionsMade}
                    Review All First
                {:else}
                    Submit All Decisions
                {/if}
            </button>
        </div>
    </div>
{:else if isBatchApproval}
    <!-- This is part of a batch but not the first - don't render, it's shown above -->
{:else}
    <!-- Single Tool Card (Simplified) -->
    <div class="card rounded-lg border-1 {borderColorClass} bg-primary-300-700 transition-all text-left">
        <!-- Card Header - Always Visible, Clickable to Expand -->
        <button
            type="button"
            class="w-full p-2 text-left flex items-center justify-between gap-3 hover:bg-primary-200-800 transition-colors rounded-lg"
            onclick={() => manualToggle = !isExpanded}
        >
            {#if statusIcon}
                {@const StatusIcon = statusIcon}
                <div class="flex items-center gap-2 flex-shrink-0">
                    <StatusIcon
                        class="{statusColorClass} {shouldSpin ? 'animate-spin' : ''}"
                        size={18}
                    />
                    <span class="font-semibold text-sm">
                        {getToolDisplayName(message.toolName)}
                    </span>
                </div>
                <div class="flex-1 border-b border-surface-300-700 mx-2 self-center"></div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs {statusColorClass}">
                        {statusDisplay}
                    </span>
                    {#if isExpanded}
                        <ChevronUp class="text-surface-600-400" size={18} />
                    {:else}
                        <ChevronDown class="text-surface-600-400" size={18} />
                    {/if}
                </div>
            {/if}
        </button>

        <!-- Expandable Content -->
        {#if isExpanded}
            <div class="border-t border-surface-300-700 p-4 space-y-4">
                <!-- Approval Interface -->
                {#if showApprovalInterface}
                    <ToolApprovalCard
                        toolMessage={message}
                        onApprove={handleApprove}
                        onDeny={handleDeny}
                    />
                {/if}

                <!-- Consent Interface -->
                {#if showConsentInterface && onConsent && onConsentDeny}
                    <ConsentRequestCard
                        toolMessage={message}
                        {onConsent}
                        onDeny={onConsentDeny}
                    />
                {/if}

                <!-- Tool Input -->
                {#if message.toolInput}
                    <div class="space-y-2">
                        <h4 class="text-sm font-semibold text-surface-950-50">Tool Input</h4>
                        <pre class="text-xs preset-filled-surface-200-800 p-3 rounded-lg border border-surface-300-700 overflow-x-auto max-h-60 text-left">{JSON.stringify(message.toolInput, null, 2)}</pre>
                    </div>
                {/if}

                <!-- Tool Output -->
                {#if message.toolOutput || message.status === 'error'}
                    <div class="space-y-2">
                        <h4 class="text-sm font-semibold text-surface-950-50">Tool Output</h4>
                        {#if message.status === 'error'}
                            <ToolError {message} />
                        {:else if message.toolName === 'obp_requests'}
                            <ObpApiResponse {message} />
                        {:else}
                            <DefaultToolResponse {message} />
                        {/if}
                    </div>
                {:else if message.isStreaming}
                    <div class="flex items-center gap-2 text-sm italic text-surface-600-400">
                        <LoaderCircle class="animate-spin" size={16} />
                        {message.waitingForConsent || message.waitingForApproval ? 'Waiting for user approval...' : 'Executing...'}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
{/if}