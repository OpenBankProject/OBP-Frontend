<script lang="ts">
  import { X, MessageCircle, Loader2 } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { insightService } from "$lib/services/InsightService";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";

  let { pathname, pageContext }: { pathname: string; pageContext: string } = $props();

  let dismissed = $state(false);
  let insightText = $state("");
  let loading = $state(true);

  onMount(() => {
    // Clear any stale summary from the previous page
    pageDataSummary.clear();
    // Wait a moment for the page to load its data and call pageDataSummary.set()
    const timer = setTimeout(() => fetchInsight(), 1500);
    return () => clearTimeout(timer);
  });

  async function fetchInsight() {
    loading = true;

    try {
      // Only write to notebook on detail pages (when pageDataSummary has content)
      if (pageDataSummary.value) {
        await insightService.writeNote(`${pageContext} — ${pageDataSummary.value}`);
      }

      // Fetch last 10 notebook entries
      const recentNotes = await insightService.getRecentNotes(10);

      // Ask Opey for a short insight based on notebook + current page
      const insight = await insightService.getInsight(pageContext, recentNotes);

      insightText = insight || pageContext;
    } catch {
      insightText = pageContext;
    } finally {
      loading = false;
    }
  }
</script>

{#if !dismissed && (loading || insightText)}
  <div
    data-testid="opey-insight-bar"
    data-state={loading ? "loading" : "ready"}
    class="flex items-center gap-3 border-b border-surface-200-800 bg-surface-50-950 px-4 py-2 text-sm"
  >
    {#if loading}
      <Loader2 class="size-4 shrink-0 animate-spin text-tertiary-500" />
      <span class="flex-1 text-surface-500">Opey is thinking...</span>
    {:else}
      <MessageCircle class="size-4 shrink-0 text-tertiary-500" />
      <span class="flex-1">{insightText}</span>
      <a
        href="/?ask={encodeURIComponent(insightText)}"
        data-testid="opey-insight-ask-button"
        class="btn btn-sm preset-tonal-tertiary shrink-0"
      >
        Ask Opey
      </a>
    {/if}
    <button
      type="button"
      data-testid="opey-insight-dismiss"
      class="hover:text-tertiary-400"
      onclick={() => (dismissed = true)}
      aria-label="Dismiss insight bar"
    >
      <X class="size-4" />
    </button>
  </div>
{/if}
