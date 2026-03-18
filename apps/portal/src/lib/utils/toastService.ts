import { createToaster } from '@skeletonlabs/skeleton-svelte';

// Create a single toaster instance for the entire application
export const toaster = createToaster({
    max: 3,
    duration: 3000,
});

// Optional: Create helper functions for common toast types
export const toast = {
    info: (title: string, description?: string) => {
        toaster.info({ title, description });
    },
    success: (title: string, description?: string) => {
        toaster.success({ title, description });
    },
    warning: (title: string, description?: string) => {
        toaster.warning({ title, description });
    },
    error: (title: string, description?: string) => {
        toaster.error({ title, description });
    },
    promise: <T>(promise: Promise<T>, options: any) => {
        return toaster.promise(promise, options);
    }
};