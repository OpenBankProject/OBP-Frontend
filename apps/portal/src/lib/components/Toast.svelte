<script lang="ts">
    import { Toast } from '@skeletonlabs/skeleton-svelte';
    import { toaster } from '$lib/utils/toastService';
</script>

<Toast.Group {toaster}>
    {#snippet children(toast)}
        <Toast {toast}>
            <Toast.Message>
                <Toast.Title>{toast.title}</Toast.Title>
                {#if toast.description}
                    <Toast.Description>{toast.description}</Toast.Description>
                {/if}
            </Toast.Message>
            {#if toast.action}
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            {/if}
            {#if toast.closable !== false}
                <Toast.CloseTrigger />
            {/if}
        </Toast>
    {/snippet}
</Toast.Group>