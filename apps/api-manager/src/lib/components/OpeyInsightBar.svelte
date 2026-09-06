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
  import { MessageCircle, Loader2, ChevronDown, ChevronRight } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { insightService } from "$lib/services/InsightService";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";
  import { userPreferences } from "$lib/stores/userPreferences.svelte";

  let { pathname, pageContext, opey_insights_is_open = $bindable(false) }: { pathname: string; pageContext: string; opey_insights_is_open: boolean } = $props();

  let insightText = $state("");
  let loading = $state(false);
  let hasFetched = $state(false);

  onMount(() => {
    pageDataSummary.clear();
    pageHeading.clear();
  });

  $effect(() => {
    if (opey_insights_is_open && !hasFetched) {
      hasFetched = true;
      setTimeout(() => fetchInsight(), 1500);
    }
  });

  let displayLabel = $derived(
    pageHeading.value ? `${pageContext}: ${pageHeading.value}` : pageContext
  );

  let editedPrompt = $state("");
  let isEditing = $state(false);

  let askPrompt = $derived(
    editedPrompt || (pageHeading.value
      ? `Tell me about the ${pageContext} ${pageHeading.value}`
      : insightText)
  );

  function startEditing() {
    editedPrompt = askPrompt;
    isEditing = true;
  }

  async function fetchInsight() {
    loading = true;

    try {
      if (pageDataSummary.value) {
        await insightService.writeNote(`${pageContext} — ${pageDataSummary.value}`);
      }

      const recentNotes = await insightService.getRecentNotes(5);
      const insight = await insightService.getInsight(pageContext, recentNotes);

      insightText = insight || displayLabel;
    } catch {
      insightText = displayLabel;
    } finally {
      loading = false;
    }
  }
</script>

{#if opey_insights_is_open}
  <div
    data-testid="opey-insight-bar"
    data-state={loading ? "loading" : "ready"}
    class="flex items-center gap-3 border-b border-surface-200-800 bg-surface-50-950 px-4 py-2 text-sm"
  >
    <button
      type="button"
      data-testid="opey-insight-toggle"
      class="hover:text-tertiary-400"
      onclick={() => userPreferences.setOpeyInsightsOpen(false)}
      aria-label="Hide insights"
    >
      <ChevronDown class="size-4" />
    </button>

    {#if loading}
      <Loader2 class="size-4 shrink-0 animate-spin text-tertiary-500" />
      <span class="flex-1 text-surface-500">Opey is thinking...</span>
    {:else}
      <MessageCircle class="size-4 shrink-0 text-tertiary-500" />
      {#if isEditing}
        <input
          type="text"
          class="flex-1 rounded border border-surface-300-700 bg-surface-50-950 px-2 py-1 text-sm focus:border-tertiary-500 focus:outline-none"
          bind:value={editedPrompt}
          data-testid="opey-insight-edit-input"
          onkeydown={(e) => { if (e.key === "Escape") isEditing = false; }}
        />
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="flex-1 cursor-text rounded px-1 hover:bg-surface-100-900"
          onclick={startEditing}
          data-testid="opey-insight-text"
        >
          {#if pageHeading.value}
            <strong>{displayLabel}</strong> — {insightText}
          {:else}
            {insightText}
          {/if}
        </span>
      {/if}
      <a
        href="/?ask={encodeURIComponent(askPrompt)}"
        data-testid="opey-insight-ask-button"
        class="btn btn-sm preset-tonal-tertiary shrink-0"
      >
        Ask Opey
      </a>
    {/if}
  </div>
{/if}
