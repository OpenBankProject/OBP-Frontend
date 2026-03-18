<script lang="ts">
    import { createLogger } from '$lib/utils/logger';
    const logger = createLogger('ConsumerRegisterSuccessPage');
    const { data } = $props()
    const consumerData = data.consumerData || {};

    let copied = $state(false)

    async function clickToCopy() {
        const formattedCredentials = Object.entries(consumerData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        try {
            await navigator.clipboard.writeText(formattedCredentials)
            copied = true

            setTimeout(() => {
                copied = false
            }, 2000)
        } catch (error) {
            logger.error('Failed to copy credentials:', error)
        }
    }
</script>

<div
	class="card preset-filled-primary-100-900 border-primary-200-800 divide-primary-200-800 mx-auto my-10 flex max-w-md flex-col divide-y border-[1px] shadow-lg sm:max-w-2xl lg:max-w-3xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Consumer registration success</h1>
	</header>
	<article class="space-y-4 p-4">
        <p class="text-center text-xl">
            Save these credentials securely.
        </p>
        <p class="text-center text-warning-400">
            You will not be able to retrieve them again.
        </p>
        <div class="preset-filled-primary-50-950 shadow-md rounded-lg p-4 m-1.5">
            <ul class="list-inside space-y-2">
                {#each Object.entries(consumerData) as [key, value]}
                    {#if key === 'created_by_user'}
                    <li>
                        <strong class="text-tertiary-400">{key}:</strong> {JSON.stringify(value)}
                    </li>
                    {:else}
                    <li>
                        <strong class="text-tertiary-400">{key}:</strong> {value}
                    </li>
                    {/if}
                {/each}
            </ul>

            <div class="mt-4 text-center">
                <button
                    class="btn preset-filled-primary-500"
                    onclick={clickToCopy}
                    disabled={copied}
                    aria-label="Copy credentials to clipboard"
                >
                    {copied ? 'Copied!' : 'Click to Copy Credentials'}
                </button>
            </div>
        </div>
	</article>
</div>
