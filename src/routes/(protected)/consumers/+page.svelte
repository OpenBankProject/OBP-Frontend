<script lang="ts">
  let { data } = $props();
  const consumers = data.consumers;
  const errorMessage = data.error;

  let searchQuery = $state("");

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  }

  let filteredConsumers = $derived(
    !consumers || !searchQuery.trim()
      ? consumers
      : consumers.filter((consumer: any) => {
          const query = searchQuery.toLowerCase();
          return (
            consumer.app_name?.toLowerCase().includes(query) ||
            consumer.consumer_id?.toLowerCase().includes(query) ||
            consumer.description?.toLowerCase().includes(query) ||
            consumer.company?.toLowerCase().includes(query) ||
            consumer.developer_email?.toLowerCase().includes(query) ||
            consumer.app_type?.toLowerCase().includes(query)
          );
        }),
  );

  $effect(() => {
    console.log("Consumers:", consumers?.length || 0);
    console.log("Search query:", searchQuery);
    console.log("Filtered consumers:", filteredConsumers?.length || 0);
  });
</script>

  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
      API Consumers
    </h1>
    {#if consumers && consumers.length > 0}
      <span class="text-sm text-gray-600 dark:text-gray-400">
        Total: {consumers.length}
      </span>
    {/if}
  </div>

  <!-- Error Message -->
  {#if errorMessage}
    <div
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <div>
          <h3 class="text-sm font-medium text-red-900 dark:text-red-100">
            Error Loading Consumers
          </h3>
          <p class="mt-1 text-sm text-red-800 dark:text-red-200">
            {errorMessage}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search Box -->
  {#if !errorMessage && consumers && consumers.length > 0}
    <div class="mb-3">
      <div class="relative">
        <div
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
        >
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search consumers by name, ID, company, email, or type..."
          class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
        {#if searchQuery}
          <button
            onclick={() => (searchQuery = "")}
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        {/if}
      </div>
      {#if searchQuery && filteredConsumers}
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredConsumers.length} of {consumers.length} consumers
        </p>
      {/if}
    </div>
  {/if}

  {#if !errorMessage && filteredConsumers && filteredConsumers.length > 0}
    <div class="space-y-2">
      {#each filteredConsumers as consumer (consumer.consumer_id)}
        <div
          class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <!-- Header with App Name and Status -->
          <div class="mb-2 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h2
                class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate"
              >
                {consumer.app_name}
              </h2>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Created: {formatDate(consumer.created)}
              </p>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <a
                href="/consumers/{consumer.consumer_id}/edit"
                class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                <svg
                  class="mr-1 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Details
              </a>
              <a
                href="/consumers/{consumer.consumer_id}/rate-limits"
                class="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <svg
                  class="mr-1 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Rate Limits
              </a>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium {consumer.enabled
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}"
              >
                {consumer.enabled ? "Enabled" : "Disabled"}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {consumer.app_type}
              </span>
            </div>
          </div>

          <!-- Description -->
          {#if consumer.description}
            <p class="mb-2 text-xs text-gray-700 dark:text-gray-300">
              {consumer.description}
            </p>
          {/if}

          <!-- Credentials Section -->
          {#if consumer.key}
            <div
              class="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/50 mb-2"
            >
              <div>
                <div
                  class="mb-0.5 block text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  Key
                </div>
                <code
                  class="block rounded bg-white px-2 py-1 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                >
                  {consumer.key}
                </code>
              </div>
            </div>
          {/if}

          <!-- Additional Details -->
          <div class="mt-2 space-y-1 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400"
                >Consumer ID:</span
              >
              <span
                class="sm:col-span-2 text-gray-900 dark:text-gray-100 font-mono"
                >{consumer.consumer_id}</span
              >
            </div>
            {#if consumer.company}
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span class="font-medium text-gray-600 dark:text-gray-400"
                  >Company:</span
                >
                <span class="sm:col-span-2 text-gray-900 dark:text-gray-100"
                  >{consumer.company}</span
                >
              </div>
            {/if}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400"
                >Developer Email:</span
              >
              <span class="sm:col-span-2 text-gray-900 dark:text-gray-100"
                >{consumer.developer_email}</span
              >
            </div>
          </div>
          <div class="mt-1 text-xs">
            <span class="font-medium text-gray-600 dark:text-gray-400">Redirect URL:</span>
            <span class="ml-1 text-gray-900 dark:text-gray-100 break-all"
              >{consumer.redirect_url || "Not specified"}</span
            >
          </div>
        </div>
      {/each}
    </div>
  {:else if !errorMessage}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
      <svg
        class="mx-auto mb-4 h-16 w-16 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
      <p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
        No API consumers found
      </p>
      <p class="mb-4 text-gray-600 dark:text-gray-400">
        You haven't registered any API consumers yet.
      </p>
      <a
        href="/consumers/register"
        class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        Register Your First Consumer
      </a>
    </div>
  {/if}
