<script lang="ts">
    import { Toast } from '@skeletonlabs/skeleton-svelte';
    import { toaster } from '$lib/utils/toastService';
</script>

<Toast.Group {toaster} placement="top-end" class="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
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