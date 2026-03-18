<script lang="ts">
    import { page } from "$app/state";
    import { Wrench, Bot, Cog, Cctv, ShieldAlert } from "@lucide/svelte";

    const errorIcons = {
        notFound: Wrench,
        internalServerError: Bot,
        underMaintenance: Cog,
        accessDenied: Cctv,
        unauthorized: ShieldAlert
    }
</script>

<div class="flex flex-col h-full w-full items-center justify-center">
    {#if page.status == 404}
        <div class="mx-auto p-5">
            <errorIcons.notFound size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center mt-10">
            <h1 class="text-2xl font-bold mb-4">Oops! Page Not Found</h1>
            <p class="text-2xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message && page.error.message !== "Not Found"}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/" class="btn btn-primary">Go to Home</a>
                <a href="/support" class="btn btn-secondary">Contact Support</a>
            </div>
        </div>
    {:else if page.status == 500}
        <div class="mx-auto p-5">
            <errorIcons.internalServerError size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center">
            <h1 class="text-2xl font-bold mb-4">Something Went Wrong</h1>
            <p class="text-xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message && page.error.message !== "Internal Server Error"}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/" class="btn btn-primary">Go to Home</a>
                <a href="/support" class="btn btn-secondary">Contact Support</a>
            </div>
        </div>
    {:else if page.status == 403}
        <div class="mx-auto p-5">
            <errorIcons.accessDenied size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center">
            <h1 class="text-2xl font-bold mb-4">Access Denied</h1>
            <p class="text-xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message && page.error.message !== "Forbidden"}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/" class="btn btn-primary">Go to Home</a>
                <a href="/support" class="btn btn-secondary">Contact Support</a>
            </div>
        </div>
    {:else if page.status == 401}
        <div class="mx-auto p-5">
            <errorIcons.unauthorized size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center">
            <h1 class="text-2xl font-bold mb-4">Please Sign In</h1>
            <p class="text-xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message && page.error.message !== "Unauthorized"}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/login" class="btn btn-primary">Log In</a>
                <a href="/register" class="btn btn-secondary">Register</a>
            </div>
        </div>
    {:else if page.status == 503}
        <div class="mx-auto p-5">
            <errorIcons.internalServerError size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center">
            <h1 class="text-2xl font-bold mb-4">We'll Be Right Back</h1>
            <p class="text-xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message && page.error.message !== "Service Unavailable"}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/" class="btn btn-primary">Go to Home</a>
                <a href="/support" class="btn btn-secondary">Contact Support</a>
            </div>
        </div>
    {:else}
        <div class="mx-auto p-5">
            <errorIcons.internalServerError size={100} color="var(--color-primary-200)"/>
        </div>
        <div class="text-center">
            <h1 class="text-2xl font-bold mb-4">Hmm, Something's Not Right</h1>
            <p class="text-xl text-gray-500 mb-4">{page.status}</p>
            {#if page.error?.message}
                <p class="text-red-500 mb-4">{page.error.message}</p>
            {/if}
            <div class="mt-6 flex justify-center space-x-4">
                <a href="/" class="btn btn-primary">Go to Home</a>
                <a href="/support" class="btn btn-secondary">Contact Support</a>
            </div>
        </div>
    {/if}
</div>