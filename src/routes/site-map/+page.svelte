<script lang="ts">
  import { SITE_MAP, checkRoles } from "$lib/utils/roleChecker";
  import type { UserEntitlement, RoleRequirement } from "$lib/utils/roleChecker";
  import { Check, X, Search, ChevronRight } from "@lucide/svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  const { data } = $props();

  let userEntitlements: UserEntitlement[] = $derived(data.userEntitlements);
  let searchQuery = $state("");

  // Section grouping based on route prefix
  const SECTION_ORDER = [
    { key: "rbac", label: "RBAC", prefix: "/rbac/" },
    { key: "system", label: "System", prefix: "/system/" },
    { key: "consumers", label: "Consumers", prefix: "/consumers" },
    { key: "metrics", label: "Metrics", prefix: "/connector-" },
    { key: "abac", label: "ABAC", prefix: "/abac/" },
    { key: "account-access", label: "Account Access", prefix: "/account-access/" },
    { key: "users", label: "Users", prefix: "/users" },
    { key: "dynamic-entities", label: "Dynamic Entities", prefix: "/dynamic-entities/" },
    { key: "integration", label: "Integration", prefix: "/integration/" },
  ];

  function getSection(route: string): string {
    for (const s of SECTION_ORDER) {
      if (route.startsWith(s.prefix)) return s.key;
    }
    return "other";
  }

  function hasRole(role: RoleRequirement): boolean {
    return userEntitlements.some((e) => {
      if (e.role_name !== role.role) return false;
      if (role.bankScoped) return currentBank.bankId ? e.bank_id === currentBank.bankId : false;
      if (role.bankId) return e.bank_id === role.bankId;
      return true;
    });
  }

  interface PageEntry {
    route: string;
    required: RoleRequirement[];
    optional: RoleRequirement[];
    accessible: boolean;
  }

  // Tree node structure
  interface TreeNode {
    segment: string;
    fullPath: string;
    entry: PageEntry | null;
    children: TreeNode[];
  }

  let allPages: PageEntry[] = $derived(
    Object.entries(SITE_MAP).map(([route, config]) => {
      const result = checkRoles(userEntitlements, config.required, currentBank.bankId);
      return {
        route,
        required: config.required,
        optional: config.optional || [],
        accessible: result.hasAllRoles,
      };
    })
  );

  let filteredPages = $derived(
    searchQuery.trim() === ""
      ? allPages
      : allPages.filter((p) => {
          const q = searchQuery.toLowerCase();
          if (p.route.toLowerCase().includes(q)) return true;
          if (p.required.some((r) => r.role.toLowerCase().includes(q))) return true;
          if (p.optional.some((r) => r.role.toLowerCase().includes(q))) return true;
          return false;
        })
  );

  // Build a tree from routes within a section
  function buildTree(pages: PageEntry[], sectionPrefix: string): TreeNode[] {
    const root: TreeNode[] = [];

    for (const page of pages) {
      // Strip the section prefix to get the relative path
      let relative = page.route;
      for (const s of SECTION_ORDER) {
        if (relative.startsWith(s.prefix)) {
          relative = relative.slice(s.prefix.length);
          break;
        }
      }
      // For routes like /consumers or /connector-metrics that match at the prefix level
      if (relative === page.route) {
        // Use the full route minus leading slash
        relative = page.route.replace(/^\//, "");
      }

      const segments = relative.split("/").filter(Boolean);
      let currentLevel = root;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;
        let existing = currentLevel.find((n) => n.segment === segment);

        if (!existing) {
          existing = {
            segment,
            fullPath: page.route,
            entry: isLast ? page : null,
            children: [],
          };
          currentLevel.push(existing);
        } else if (isLast) {
          existing.entry = page;
          existing.fullPath = page.route;
        }

        currentLevel = existing.children;
      }
    }

    return root;
  }

  let groupedPages = $derived.by(() => {
    const groups: Record<string, PageEntry[]> = {};
    for (const p of filteredPages) {
      const section = getSection(p.route);
      if (!groups[section]) groups[section] = [];
      groups[section].push(p);
    }
    return groups;
  });

  let sectionTrees = $derived.by(() => {
    const trees: Record<string, TreeNode[]> = {};
    for (const [key, pages] of Object.entries(groupedPages)) {
      const section = SECTION_ORDER.find((s) => s.key === key);
      trees[key] = buildTree(pages, section?.prefix || "/");
    }
    return trees;
  });

  let orderedSections = $derived(
    [...SECTION_ORDER.map((s) => s.key), "other"].filter((k) => groupedPages[k]?.length)
  );

  function sectionLabel(key: string): string {
    const found = SECTION_ORDER.find((s) => s.key === key);
    return found ? found.label : "Other";
  }

  function getMissingRoles(entry: PageEntry): string[] {
    const missing: string[] = [];
    for (const r of entry.required) {
      if (!hasRole(r)) missing.push(r.role);
    }
    return missing;
  }

  // Summary counts
  let totalPages = $derived(filteredPages.length);
  let accessiblePages = $derived(filteredPages.filter((p) => p.accessible).length);
  let blockedPages = $derived(totalPages - accessiblePages);
</script>

<!-- Site Map -->
<div class="site-map-container">

<!-- Summary -->
<div class="summary-bar">
  <div class="summary-item">
    <span class="summary-count">{totalPages}</span>
    <span class="summary-label">Total pages</span>
  </div>
  <div class="summary-item accessible">
    <span class="summary-count">{accessiblePages}</span>
    <span class="summary-label">Accessible</span>
  </div>
  <div class="summary-item blocked">
    <span class="summary-count">{blockedPages}</span>
    <span class="summary-label">Blocked</span>
  </div>
</div>

<!-- Search -->
<div class="search-box">
  <Search size={16} />
  <input
    type="text"
    placeholder="Filter by route or role name..."
    bind:value={searchQuery}
  />
</div>

<!-- Grouped pages as trees -->
{#each orderedSections as sectionKey}
  <div class="section">
    <div class="section-header">
      <h3 class="section-title">{sectionLabel(sectionKey)}</h3>
      <span class="section-count">{groupedPages[sectionKey].length}</span>
    </div>

    <div class="tree">
      {#snippet renderNode(node: TreeNode, isLast: boolean, depth: number)}
        <div class="tree-item" class:blocked={node.entry && !node.entry.accessible}>
          <div class="tree-row">
            <div class="tree-indent" style="width: {depth * 1.5}rem"></div>
            <span class="tree-connector">{isLast ? "└── " : "├── "}</span>
            {#if node.entry}
              <a href={node.entry.route} class="tree-link" class:blocked={!node.entry.accessible}>
                <span class="tree-segment">{node.segment}</span>
              </a>
            {:else}
              <span class="tree-segment tree-folder">{node.segment}</span>
            {/if}
            {#if node.entry}
              <div class="roles-list">
                {#each node.entry.required as role}
                  <span class="role-badge" class:has={hasRole(role)} class:missing={!hasRole(role)}>
                    {#if hasRole(role)}
                      <Check size={11} />
                    {:else}
                      <X size={11} />
                    {/if}
                    {role.role}
                    {#if role.bankScoped}
                      <span class="scope-label">bank</span>
                    {/if}
                  </span>
                {/each}
                {#each node.entry.optional as role}
                  <span class="role-badge optional" class:has={hasRole(role)} class:missing={!hasRole(role)}>
                    {#if hasRole(role)}
                      <Check size={11} />
                    {:else}
                      <X size={11} />
                    {/if}
                    {role.role}
                    <span class="optional-label">optional</span>
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          {#if node.entry && getMissingRoles(node.entry).length > 0}
            <div class="tree-alert" style="margin-left: {(depth + 1) * 1.5 + 2.5}rem">
              <MissingRoleAlert roles={getMissingRoles(node.entry)} />
            </div>
          {/if}
        </div>
        {#each node.children as child, i (child.fullPath)}
          {@render renderNode(child, i === node.children.length - 1, depth + 1)}
        {/each}
      {/snippet}

      {#each sectionTrees[sectionKey] as node, i (node.fullPath)}
        {@render renderNode(node, i === sectionTrees[sectionKey].length - 1, 0)}
      {/each}
    </div>
  </div>
{/each}

{#if filteredPages.length === 0}
  <p class="empty-text">No pages match your search.</p>
{/if}

</div>

<style>
  .site-map-container {
    padding: 1.5rem;
    max-width: 100%;
    overflow-x: auto;
  }

  /* Summary bar */
  .summary-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-width: 100px;
  }

  :global([data-mode="dark"]) .summary-item {
    background: rgb(var(--color-surface-800));
  }

  .summary-item.accessible .summary-count {
    color: #16a34a;
  }

  .summary-item.blocked .summary-count {
    color: #dc2626;
  }

  .summary-count {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .summary-count {
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .summary-item.accessible .summary-count {
    color: rgb(var(--color-success-400));
  }

  :global([data-mode="dark"]) .summary-item.blocked .summary-count {
    color: rgb(var(--color-error-400));
  }

  .summary-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .summary-label {
    color: var(--color-surface-400);
  }

  /* Search */
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  :global([data-mode="dark"]) .search-box {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-700));
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .search-box input {
    color: var(--color-surface-100);
  }

  .search-box input::placeholder {
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .search-box input::placeholder {
    color: var(--color-surface-500);
  }

  /* Sections */
  .section {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .section {
    background: rgb(var(--color-surface-800));
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .section-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
  }

  .section-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .section-count {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  /* Tree */
  .tree {
    padding: 0.5rem 1rem 0.75rem;
    font-family: monospace;
  }

  .tree-item {
    display: flex;
    flex-direction: column;
  }

  .tree-item.blocked {
    background: #fef2f2;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) .tree-item.blocked {
    background: rgba(220, 38, 38, 0.05);
  }

  .tree-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
    padding: 0.3rem 0;
    min-height: 1.75rem;
  }

  .tree-indent {
    flex-shrink: 0;
  }

  .tree-connector {
    flex-shrink: 0;
    color: #d1d5db;
    font-size: 0.8rem;
    white-space: pre;
    user-select: none;
  }

  :global([data-mode="dark"]) .tree-connector {
    color: var(--color-surface-600);
  }

  .tree-segment {
    font-size: 0.8rem;
    font-weight: 500;
  }

  .tree-folder {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .tree-folder {
    color: var(--color-surface-400);
  }

  .tree-link {
    text-decoration: none;
    color: #2563eb;
  }

  .tree-link:hover {
    text-decoration: underline;
  }

  .tree-link.blocked {
    color: #dc2626;
  }

  :global([data-mode="dark"]) .tree-link {
    color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .tree-link.blocked {
    color: rgb(var(--color-error-400));
  }

  .tree-alert {
    padding-bottom: 0.25rem;
  }

  /* Roles */
  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-left: 0.75rem;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 500;
  }

  .role-badge.has {
    background: #f0fdf4;
    color: #166534;
  }

  :global([data-mode="dark"]) .role-badge.has {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(var(--color-success-300));
  }

  .role-badge.missing {
    background: #fef2f2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .role-badge.missing {
    background: rgba(220, 38, 38, 0.15);
    color: rgb(var(--color-error-300));
  }

  .role-badge.optional {
    border: 1px dashed currentColor;
    opacity: 0.85;
  }

  .optional-label {
    font-size: 0.55rem;
    opacity: 0.7;
    font-style: italic;
  }

  .scope-label {
    font-size: 0.55rem;
    opacity: 0.7;
    padding: 0 0.2rem;
    border: 1px solid currentColor;
    border-radius: 3px;
  }

  .empty-text {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .empty-text {
    color: var(--color-surface-400);
  }
</style>
