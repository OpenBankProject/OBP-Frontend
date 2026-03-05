<script lang="ts">
  import { Accordion } from "@skeletonlabs/skeleton-svelte";
  import { type SessionData } from "svelte-kit-sessions";
  import ConsentCard from "$lib/components/ConsentCard.svelte";
  import { toast } from "$lib/utils/toastService.js";
  import { Clock } from "@lucide/svelte";
  import { userPreferences, DATE_FORMAT_OPTIONS, THEME_OPTIONS, type DateFormat, type Theme } from "$lib/stores/userPreferences.svelte";
  const { data } = $props();
  const userData: SessionData["user"] = data.userData || undefined;
  const entitlementRequests = data.entitlementRequests || [];
  const hasApiAccess = data.hasApiAccess;
  const error = data.error;

  console.debug("USER DATA:", JSON.stringify(userData));

  const opeyConsentInfo = data.opeyConsentInfo || null;
  const sessionInfo = data.sessionInfo || null;

  function formatTimeRemaining(seconds: number | null): string {
    if (seconds === null) return "Unknown";
    if (seconds <= 0) return "Expired";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  function tokenStatusColor(seconds: number | null): string {
    if (seconds === null) return "bg-surface-300 dark:bg-surface-600";
    if (seconds <= 0) return "bg-error-500";
    if (seconds < 300) return "bg-warning-500";
    return "bg-success-500";
  }

  function formatDateFromUnix(epochDateMilliseconds: number | string): string {
    console.log("Formatting date:", epochDateMilliseconds);
    return new Date(epochDateMilliseconds).toLocaleString();
  }

  function fromatDateFromISO(isoDateString: string): string {
    return new Date(isoDateString).toLocaleString();
  }

  function formatJwtExpiration(epochDateMilliseconds: number | string) {
    const date = new Date(epochDateMilliseconds);
    const now = new Date();
    const isExpired = date < now;
    return {
      formatted: date.toLocaleString(),
      isExpired,
    };
  }

  function snakeCaseToTitleCase(snakeCase: string): string {
    return snakeCase
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // New function to copy text to clipboard with feedback
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.info("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast.error("Failed to copy to clipboard.");
    }
  }

  async function copyJsonToClipboard(jsonData: object) {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      toast.info("User JSON copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy JSON: ", err);
      toast.error("Failed to copy JSON to clipboard.");
    }
  }

  // Track which complex data items are expanded
  let expandedItems = $state([]);

  // Format complex data for display
  function formatValue(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }
    return JSON.stringify(value, null, 2);
  }

  // Enhanced function to check if an object contains a single array property
  function isSingleArrayContainer(value: any): boolean {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const keys = Object.keys(value);
    // Check if it's an object with exactly one property
    if (keys.length !== 1) {
      return false;
    }

    // Check if that one property is an array
    return Array.isArray(value[keys[0]]);
  }

  // Get the array from an object containing a single array property
  function getSingleArray(value: any): any[] {
    if (!isSingleArrayContainer(value)) return [];
    const key = Object.keys(value)[0];
    return value[key];
  }

  // Get a display summary for complex values
  function getComplexValueSummary(value: any): string {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    } else if (isSingleArrayContainer(value)) {
      const array = getSingleArray(value);
      return `[${array.length} items]`;
    } else if (value !== null && typeof value === "object") {
      return `{${Object.keys(value).length} properties}`;
    }
    return String(value);
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "N/A";
    }
  }
</script>

{#snippet userInfo(userData: SessionData["user"])}
  {#if userData && Object.keys(userData).length > 0}
    <div class="mx-10 pr-5">
      <header class="flex items-center justify-between py-4">
        <h1 class="h4 text-center align-middle">User Information</h1>
        <button
          class="btn preset-outlined-tertiary-500 rounded-md p-1 text-sm"
          onclick={() => copyJsonToClipboard(userData)}>Copy JSON</button
        >
      </header>
      <article class="border-primary-500 space-y-3 border-b-[1px] p-4">
        <!-- Group entries by type -->
        {#each Object.entries(userData) as [key, value]}
          {#if Array.isArray(value) || (value !== null && typeof value === "object")}
            <!-- Complex values use accordion -->
            <Accordion
              value={expandedItems}
              onValueChange={(details: any) => (expandedItems = details.value)}
              multiple
              collapsible
            >
              <Accordion.Item value={key} class="border-0">
                <h4>
                  <Accordion.ItemTrigger
                    class="flex w-full items-center justify-between"
                  >
                    <strong>{snakeCaseToTitleCase(key)}</strong>
                    <span class="text-tertiary-400 text-sm">
                      {getComplexValueSummary(value)}
                    </span>
                  </Accordion.ItemTrigger>
                </h4>

                <Accordion.ItemContent>
                  {#if Array.isArray(value)}
                    <!-- Array rendering -->
                    <div class="space-y-2">
                      {#each value as item, i}
                        <div class="flex items-start gap-2">
                          <span class="text-tertiary-400 w-8">{i}:</span>
                          {#if item !== null && typeof item === "object"}
                            <div class="flex-1">
                              <pre
                                class="max-w-full overflow-x-auto rounded bg-gray-800/10 p-2 text-sm">
                                                                {JSON.stringify(
                                  item,
                                  null,
                                  2,
                                )}
                                                            </pre>
                              <button
                                class="btn btn-sm preset-outlined-tertiary-500 mt-1"
                                onclick={() =>
                                  copyToClipboard(
                                    JSON.stringify(item, null, 2),
                                  )}
                              >
                                Copy
                              </button>
                            </div>
                          {:else}
                            <div class="flex items-center gap-2">
                              <span>{formatValue(item)}</span>
                              <button
                                class="btn btn-sm preset-tonal-tertiary"
                                onclick={() => copyToClipboard(String(item))}
                              >
                                Copy
                              </button>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {:else if isSingleArrayContainer(value)}
                    <!-- Object with single array property -->
                    <div class="space-y-2">
                      {#each Object.entries(value) as [arrayKey, arrayValue]}
                        <div class="flex items-start gap-2">
                          <span class="text-tertiary-400 min-w-20 font-semibold"
                            >{arrayKey}:</span
                          >
                          {#if Array.isArray(arrayValue)}
                            <div class="flex-1 space-y-2">
                              {#each arrayValue as item, i}
                                <div class="flex items-start gap-2">
                                  <span class="text-tertiary-400 w-8">{i}:</span
                                  >
                                  {#if item !== null && typeof item === "object"}
                                    <div class="flex-1">
                                      <pre
                                        class="max-w-full overflow-x-auto rounded bg-gray-800/10 p-2 text-sm">
                                                                                {JSON.stringify(
                                          item,
                                          null,
                                          2,
                                        )}
                                                                            </pre>
                                      <button
                                        class="btn btn-sm preset-outlined-tertiary-500 mt-1"
                                        onclick={() =>
                                          copyToClipboard(
                                            JSON.stringify(item, null, 2),
                                          )}
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  {:else}
                                    <div class="flex items-center gap-2">
                                      <span>{formatValue(item)}</span>
                                      <button
                                        class="btn btn-sm preset-tonal-tertiary"
                                        onclick={() =>
                                          copyToClipboard(String(item))}
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <span>{formatValue(arrayValue)}</span>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {:else if value !== null && typeof value === "object"}
                    <!-- Regular object rendering -->
                    <div class="space-y-2">
                      {#each Object.entries(value) as [subKey, subValue]}
                        <div class="flex items-start gap-2">
                          <span class="text-tertiary-400 min-w-20 font-semibold"
                            >{subKey}:</span
                          >
                          {#if subValue !== null && typeof subValue === "object"}
                            <div class="flex-1">
                              <pre
                                class="max-w-full overflow-x-auto rounded bg-gray-800/10 p-2 text-sm">
                                                                {JSON.stringify(
                                  subValue,
                                  null,
                                  2,
                                )}
                                                            </pre>
                              <button
                                class="btn btn-sm preset-outlined-tertiary-500 mt-1"
                                onclick={() =>
                                  copyToClipboard(
                                    JSON.stringify(subValue, null, 2),
                                  )}
                              >
                                Copy
                              </button>
                            </div>
                          {:else}
                            <div class="flex items-center gap-2">
                              <span>{formatValue(subValue)}</span>
                              <button
                                class="btn btn-sm preset-tonal-tertiary"
                                onclick={() =>
                                  copyToClipboard(String(subValue))}
                              >
                                Copy
                              </button>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </Accordion.ItemContent>
              </Accordion.Item>
            </Accordion>
            <hr class="hr !my-1 opacity-30" />
          {:else}
            <!-- Simple values displayed directly -->
            <div
              class="hover:bg-primary-500/5 flex items-center justify-between rounded-md p-2"
            >
              <strong>{snakeCaseToTitleCase(key)}</strong>
              <div class="flex items-center gap-2">
                <span class="rounded-sm bg-gray-800/20 p-2 backdrop-blur-2xl">
                  {value}
                </span>
                <button
                  class="btn-icon btn-sm preset-tonal-tertiary"
                  onclick={() => copyToClipboard(String(value))}
                  title="Copy to clipboard"
                  aria-label="Copy to clipboard"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path
                      d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <hr class="hr !my-0 opacity-20" />
          {/if}
        {/each}
      </article>
    </div>
  {:else}
    <div class="mx-10 pr-5">
      <p>No user data available.</p>
    </div>
  {/if}
{/snippet}

<div class="flex flex-col space-y-6">
  {@render userInfo(userData)}

  <!-- Session Info Section -->
  <div class="mx-10 pr-5">
    <header class="py-4">
      <h1 class="h4 text-center align-middle">Session Info</h1>
    </header>
    {#if sessionInfo && sessionInfo.hasAccessToken}
      <article class="border-primary-500 space-y-1 border-b-[1px] p-4">
        {#each [
          { label: "Session ID", value: sessionInfo.sessionId },
          { label: "OAuth Provider", value: sessionInfo.oauthProvider },
        ] as item}
          <div class="hover:bg-primary-500/5 flex items-center justify-between rounded-md p-2" data-testid={`session-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <strong>{item.label}</strong>
            <span class="rounded-sm bg-gray-800/20 p-2 font-mono text-sm backdrop-blur-2xl">
              {item.value || "N/A"}
            </span>
          </div>
          <hr class="hr !my-0 opacity-20" />
        {/each}

        <!-- Access Token -->
        <div class="hover:bg-primary-500/5 flex items-center justify-between rounded-md p-2" data-testid="session-access-token">
          <div class="flex items-center gap-2">
            <strong>Access Token</strong>
            <span class="h-2.5 w-2.5 rounded-full {tokenStatusColor(sessionInfo.accessTokenExpiresInSeconds)}" title={sessionInfo.accessTokenExpiresInSeconds !== null && sessionInfo.accessTokenExpiresInSeconds <= 0 ? "Expired" : "Active"}></span>
          </div>
          <div class="flex items-center gap-3">
            <span class="rounded-sm bg-gray-800/20 p-2 font-mono text-sm backdrop-blur-2xl">
              {sessionInfo.accessTokenPreview || "N/A"}
            </span>
            <span class="text-xs text-surface-600 dark:text-surface-400">
              {#if sessionInfo.accessTokenExpiresInSeconds !== null && sessionInfo.accessTokenExpiresInSeconds <= 0}
                Expired
              {:else}
                {formatTimeRemaining(sessionInfo.accessTokenExpiresInSeconds)} remaining
              {/if}
            </span>
          </div>
        </div>
        <hr class="hr !my-0 opacity-20" />

        <!-- Refresh Token -->
        <div class="hover:bg-primary-500/5 flex items-center justify-between rounded-md p-2" data-testid="session-refresh-token">
          <div class="flex items-center gap-2">
            <strong>Refresh Token</strong>
            {#if sessionInfo.hasRefreshToken}
              <span class="h-2.5 w-2.5 rounded-full {tokenStatusColor(sessionInfo.refreshTokenExpiresInSeconds)}" title={sessionInfo.refreshTokenExpiresInSeconds !== null && sessionInfo.refreshTokenExpiresInSeconds <= 0 ? "Expired" : "Active"}></span>
            {:else}
              <span class="h-2.5 w-2.5 rounded-full bg-error-500" title="Missing"></span>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            {#if sessionInfo.hasRefreshToken}
              <span class="rounded-sm bg-gray-800/20 p-2 font-mono text-sm backdrop-blur-2xl">
                {sessionInfo.refreshTokenPreview}
              </span>
              <span class="text-xs text-surface-600 dark:text-surface-400">
                {#if sessionInfo.refreshTokenExpiresAt === null}
                  Expiry unknown (not a JWT)
                {:else if sessionInfo.refreshTokenExpiresInSeconds !== null && sessionInfo.refreshTokenExpiresInSeconds <= 0}
                  Expired
                {:else}
                  {formatTimeRemaining(sessionInfo.refreshTokenExpiresInSeconds)} remaining
                {/if}
              </span>
            {:else}
              <span class="text-xs text-error-600 dark:text-error-400">
                None — session cannot auto-renew
              </span>
            {/if}
          </div>
        </div>
        <hr class="hr !my-0 opacity-20" />
      </article>
    {:else}
      <article class="border-primary-500 border-b-[1px] p-4">
        <div class="rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20" data-testid="session-warning">
          <p class="text-sm text-warning-700 dark:text-warning-300">
            No active session found. Your session may have expired.
            <a href="/login" class="font-medium underline hover:text-warning-900 dark:hover:text-warning-100">Log in again</a> to restore full functionality.
          </p>
        </div>
      </article>
    {/if}
  </div>

  <!-- Preferences Section -->
  <div class="mx-10 pr-5">
    <header class="flex items-center justify-between py-4">
      <h1 class="h4 text-center align-middle">Preferences</h1>
    </header>
    <article class="border-primary-500 space-y-4 border-b-[1px] p-4">
      <div class="flex items-center justify-between rounded-md p-2 hover:bg-primary-500/5">
        <strong>Date Format</strong>
        <select
          class="rounded-md border border-surface-300-700 bg-surface-100-900 px-3 py-1.5 text-sm"
          value={userPreferences.dateFormat}
          onchange={(e) => userPreferences.setDateFormat(e.currentTarget.value as DateFormat)}
        >
          {#each DATE_FORMAT_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <hr class="hr !my-0 opacity-20" />
      <div class="flex items-center justify-between rounded-md p-2 hover:bg-primary-500/5">
        <strong>Theme</strong>
        <select
          class="rounded-md border border-surface-300-700 bg-surface-100-900 px-3 py-1.5 text-sm"
          value={userPreferences.theme}
          onchange={(e) => userPreferences.setTheme(e.currentTarget.value as Theme)}
        >
          {#each THEME_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <p class="text-xs text-surface-500">Preferences are saved to your account and sync across devices.</p>
    </article>
  </div>

  <!-- My Entitlement Requests Section -->
  <div class="mx-10 pr-5">
    <header class="flex items-center justify-between py-4">
      <h1 class="h4 text-center align-middle">My Entitlement Requests</h1>
    </header>

    {#if error && !hasApiAccess}
      <div class="alert alert-error mb-6">
        <strong>Error:</strong>
        {error}
      </div>
    {:else if entitlementRequests.length === 0}
      <div class="empty-state">
        <Clock size={48} class="mx-auto mb-4 text-gray-400" />
        <p class="text-gray-600 dark:text-gray-400">
          No pending entitlement requests
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Role Name
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Bank ID
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Created
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900"
          >
            {#each entitlementRequests as request}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td
                  class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {request.role_name}
                </td>
                <td
                  class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                >
                  {#if request.bank_id}
                    <span
                      class="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {request.bank_id}
                    </span>
                  {:else}
                    <span
                      class="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    >
                      System-wide
                    </span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                >
                  {formatDate(request.created)}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    class="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                  >
                    <Clock size={12} class="mr-1" />
                    Pending
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  {#if opeyConsentInfo && opeyConsentInfo.hasActiveConsent && opeyConsentInfo.consent}
    <header class="py-4" id="opey-consent">
      <h1 class="h4 text-center">Consent for Opey</h1>
    </header>
    <div class="mx-auto w-4/6">
      <ConsentCard consent={opeyConsentInfo.consent} showDeleteButton={false} />
    </div>
  {/if}
  <!-- <div
		class="card preset-filled-primary-100-900 border-primary-200-800 divide-primary-200-800 mx-auto my-10 flex max-w-md flex-col divide-y border-[1px] shadow-lg sm:max-w-2xl lg:max-w-3xl"
	>
		<header class="py-4">
			<h1 class="h4 text-center">Consent for Opey</h1>
		</header>
		<article class="space-y-4 p-4">
			{#if opeyConsentInfo}
				<div class="preset-filled-primary-50-950 m-1.5 rounded-lg p-4 shadow-md">
					{#if opeyConsentInfo.hasActiveConsent}
						<div class="mb-4 flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-green-500"></div>
							<span class="font-semibold text-gray-900 dark:text-gray-100">Active Consent</span>
						</div>
						<ul class="list-inside space-y-2 text-gray-900 dark:text-gray-100">
							<li>
								<strong class="text-tertiary-400">Consent ID:</strong>
								{opeyConsentInfo.consent_id}
							</li>
							<li>
								<strong class="text-tertiary-400">Status:</strong>
								{opeyConsentInfo.status}
							</li>
							<li>
								<strong class="text-tertiary-400">Consumer ID:</strong>
								{opeyConsentInfo.consumer_id}
							</li>
							<li>
								<strong class="text-tertiary-400">Created At:</strong>
								{opeyConsentInfo.jwt_payload?.iat ? formatDateFromUnix(opeyConsentInfo.jwt_payload?.iat * 1000) : 'Not available'}
							</li>
							{#if opeyConsentInfo.last_usage_date}
								<li>
									<strong class="text-tertiary-400">Last Usage Date:</strong>
									{fromatDateFromISO(opeyConsentInfo.last_usage_date)}
								</li>
							{/if}
							{#if opeyConsentInfo.jwt_payload?.exp}
								{@const jwtExp = formatJwtExpiration(opeyConsentInfo.jwt_payload?.exp * 1000)}
								<li>
									<strong class="text-tertiary-400">JWT Expires:</strong>
									{jwtExp.formatted}
									{jwtExp.isExpired ? '(Expired)' : ''}
								</li>
							{/if}
						</ul>
						<div class="bg-primary-100 dark:bg-primary-900/20 mt-4 rounded-lg p-3">
							<p class="text-sm text-gray-700 dark:text-gray-300">
								<strong>Info:</strong> This consent allows Opey to access your Open Bank Project data
								on your behalf. The JWT token is used for secure communication between the portal and
								Opey services.
							</p>
						</div>
						<div class="mt-4">
							<a
								href="/user/consents"
								class="hover:text-tertiary-400 text-sm font-medium underline"
							>
								All My Consents
							</a>
						</div>
					{:else}
						<div class="mb-4 flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-yellow-500"></div>
							<span class="font-semibold text-gray-900 dark:text-gray-100">No Active Consent</span>
						</div>
						{#if opeyConsentInfo.error}
							<div class="bg-primary-100 dark:bg-primary-900/20 rounded-lg p-3">
								<p class="text-gray-700 dark:text-gray-300">
									<strong>Error:</strong>
									{opeyConsentInfo.error}
								</p>
							</div>
						{:else}
							<div class="bg-primary-100 dark:bg-primary-900/20 rounded-lg p-3">
								<p class="text-gray-700 dark:text-gray-300">
									{opeyConsentInfo.message}
								</p>
							</div>
						{/if}
						<div class="mt-4">
							<a
								href="/user/consents"
								class="hover:text-tertiary-400 text-sm font-medium underline"
							>
								All My Consents
							</a>
						</div>
					{/if}
				</div>
			{:else}
				<div class="preset-filled-primary-50-950 m-1.5 rounded-lg p-4 shadow-md">
					<p class="text-surface-600-400 text-center">Opey integration not configured.</p>
					<div class="mt-4 text-center">
						<a href="/user/consents" class="hover:text-tertiary-400 text-sm font-medium underline">
							All My Consents
						</a>
					</div>
				</div>
			{/if}
		</article>
	</div> -->
</div>
