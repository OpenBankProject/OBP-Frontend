<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
    import { createLogger } from '@obp/shared/utils';
    const logger = createLogger('ConsumerRegisterSuccessPage');
    const { data } = $props()
    const consumerData = data.consumerData || {};
    const apiHost: string = data.apiHost || '';
    // OBP-API enables a Consumer registered here only when its consumers_enabled_by_default prop allows it
    const isDisabled = consumerData.enabled === false;

    let copied = $state(false)

    async function clickToCopy() {
        const lines = Object.entries(consumerData)
            .map(([key, value]) => `${key}: ${value}`);
        // The API host goes first, so the copied credentials say where they work
        const formattedCredentials = (apiHost ? [`api_host: ${apiHost}`, ...lines] : lines)
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
	class="card ui-panel ui-border mx-auto my-10 flex max-w-md flex-col divide-y border-[1px] shadow-lg sm:max-w-2xl lg:max-w-3xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Consumer registration success</h1>
	</header>
	<article class="space-y-4 p-4">
        <p class="text-center text-xl">
            Save these credentials securely.
        </p>
        <p class="text-center ui-text-warning">
            You will not be able to retrieve them again.
        </p>
        {#if isDisabled}
            <div class="rounded-lg p-3 ui-tone-warning" role="alert" data-testid="consumer-disabled-warning">
                <p class="text-sm ui-text-warning">
                    This Consumer is disabled. Its key and secret will not work until an administrator enables it.
                    Ask an administrator of this API to enable Consumer ID <code>{consumerData.consumer_id}</code>.
                </p>
            </div>
        {/if}
        <div class="ui-card shadow-md rounded-lg p-4 m-1.5">
            {#if apiHost}
                <p class="mb-2" data-testid="consumer-api-host">
                    <strong class="ui-link">API Host:</strong> {apiHost}
                </p>
            {/if}
            <ul class="list-inside space-y-2">
                {#each Object.entries(consumerData) as [key, value]}
                    {#if key === 'created_by_user'}
                    <li>
                        <strong class="ui-link">{key}:</strong> {JSON.stringify(value)}
                    </li>
                    {:else}
                    <li>
                        <strong class="ui-link">{key}:</strong> {value}
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
