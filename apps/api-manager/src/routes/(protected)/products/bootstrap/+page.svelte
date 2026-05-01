<script lang="ts">
  import {
    Rocket,
    ChevronDown,
    ChevronRight,
    Check,
    AlertCircle,
    Loader2,
    Info,
    Trash2,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import {
    bootstrapJourneys,
    type BootstrapCollection,
    type BootstrapProduct,
  } from "$lib/config/bootstrapJourneys";

  type ItemStatus = "idle" | "creating" | "created" | "error" | "deleting";

  let selectedBankId = $state(currentBank.bankId);

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });

  // Status tracking for each collection and product
  let collectionStatus = $state<Record<string, ItemStatus>>({});
  let collectionIds = $state<Record<string, string>>({}); // collection_name -> api_collection_id
  let collectionErrors = $state<Record<string, string>>({});

  let productStatus = $state<Record<string, ItemStatus>>({});
  let productErrors = $state<Record<string, string>>({});

  // Track which collections are expanded
  let expandedCollections = $state<Record<string, boolean>>({});

  // Progress counters
  const collectionsCreated = $derived(
    bootstrapJourneys.filter((c) => collectionStatus[c.id] === "created").length,
  );
  const totalProducts = $derived(
    bootstrapJourneys.reduce((sum, c) => sum + c.products.length, 0),
  );
  const productsCreated = $derived(
    bootstrapJourneys.reduce(
      (sum, c) =>
        sum + c.products.filter((p) => productStatus[p.id] === "created").length,
      0,
    ),
  );

  const isAnyCreating = $derived(
    Object.values(collectionStatus).some((s) => s === "creating") ||
      Object.values(productStatus).some((s) => s === "creating"),
  );

  const isAnyBusy = $derived(
    isAnyCreating ||
      Object.values(collectionStatus).some((s) => s === "deleting") ||
      Object.values(productStatus).some((s) => s === "deleting"),
  );

  const allDone = $derived(
    collectionsCreated === bootstrapJourneys.length &&
      productsCreated === totalProducts,
  );

  function toggleExpand(collectionId: string) {
    expandedCollections[collectionId] = !expandedCollections[collectionId];
  }

  // ── Create a single collection (idempotent) ─────────────────────
  async function createCollection(collection: BootstrapCollection) {
    collectionStatus[collection.id] = "creating";
    collectionErrors[collection.id] = "";

    try {
      let collectionId: string;

      // Check if collection already exists by name (handles OBP soft-delete / uniqueness)
      const existingRes = await trackedFetch(
        `/proxy/obp/v6.0.0/my/api-collections/name/${encodeURIComponent(collection.collection_name)}`,
      );

      if (existingRes.ok) {
        const existing = await existingRes.json();
        collectionId = existing.api_collection_id;
        collectionIds[collection.collection_name] = collectionId;
      } else {
        // Collection doesn't exist — create it
        const res = await trackedFetch("/backend/api-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_collection_name: collection.collection_name,
            description: collection.description,
            is_sharable: collection.is_sharable,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message ?? `HTTP ${res.status}`);
        }

        const created = await res.json();
        collectionId = created.api_collection_id;
        collectionIds[collection.collection_name] = collectionId;
      }

      // Step 2: Add endpoints
      let failedEndpoints: string[] = [];
      for (const ep of collection.endpoints) {
        try {
          const epRes = await trackedFetch(
            `/backend/api-collections/${collectionId}/endpoints`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operation_id: ep.operation_id }),
            },
          );
          if (!epRes.ok) failedEndpoints.push(ep.operation_id);
        } catch {
          failedEndpoints.push(ep.operation_id);
        }
      }

      collectionStatus[collection.id] = "created";

      if (failedEndpoints.length > 0) {
        toast.warning(
          `Collection "${collection.collection_name}" created`,
          `${failedEndpoints.length} of ${collection.endpoints.length} endpoints could not be added: ${failedEndpoints.join(", ")}`,
        );
      } else {
        toast.success(
          "Collection Created",
          `"${collection.collection_name}" with ${collection.endpoints.length} endpoints`,
        );
      }
    } catch (err) {
      collectionStatus[collection.id] = "error";
      const msg = err instanceof Error ? err.message : "Unknown error";
      collectionErrors[collection.id] = msg;
      toast.error("Collection Error", msg);
    }
  }

  // ── Create a single product ──────────────────────────────────────
  async function createProduct(
    collection: BootstrapCollection,
    product: BootstrapProduct,
  ) {
    if (!selectedBankId) {
      toast.error("No Bank Selected", "Please select a bank first");
      return;
    }

    productStatus[product.id] = "creating";
    productErrors[product.id] = "";

    try {
      // Create product via PUT with all core fields
      const collectionId = collectionIds[collection.collection_name] || "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${selectedBankId}/api-products/${product.product_code}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product.name,
            description: product.description,
            parent_api_product_code: "",
            collection_id: collectionId,
            monthly_subscription_amount: product.monthly_subscription_amount,
            monthly_subscription_currency: product.monthly_subscription_currency,
            per_second_call_limit: Number(product.per_second_call_limit) || -1,
            per_minute_call_limit: Number(product.per_minute_call_limit) || -1,
            per_hour_call_limit: Number(product.per_hour_call_limit) || -1,
            per_day_call_limit: Number(product.per_day_call_limit) || -1,
            per_week_call_limit: Number(product.per_week_call_limit) || -1,
            per_month_call_limit: Number(product.per_month_call_limit) || -1,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }

      productStatus[product.id] = "created";
      toast.success("Product Created", `"${product.name}"`);

    } catch (err) {
      productStatus[product.id] = "error";
      const msg = err instanceof Error ? err.message : "Unknown error";
      productErrors[product.id] = msg;
      toast.error("Product Error", msg);
    }
  }

  // ── Create All for a single collection ───────────────────────────
  async function createAllForCollection(collection: BootstrapCollection) {
    if (collectionStatus[collection.id] !== "created") {
      await createCollection(collection);
    }
    if (collectionStatus[collection.id] !== "created") return;

    for (const product of collection.products) {
      if (productStatus[product.id] !== "created") {
        await createProduct(collection, product);
      }
    }
  }

  // ── Bootstrap All ────────────────────────────────────────────────
  async function bootstrapAll() {
    for (const collection of bootstrapJourneys) {
      await createAllForCollection(collection);
    }
  }

  // ── Delete a collection and its products ──────────────────────────
  async function deleteCollectionAndProducts(collection: BootstrapCollection) {
    // Mark everything as deleting
    collectionStatus[collection.id] = "deleting";
    collectionErrors[collection.id] = "";
    for (const product of collection.products) {
      if (productStatus[product.id] === "created" || productStatus[product.id] === "error") {
        productStatus[product.id] = "deleting";
        productErrors[product.id] = "";
      }
    }

    // Step 1: Delete products (cascade removes attributes too)
    if (selectedBankId) {
      for (const product of collection.products) {
        if (productStatus[product.id] !== "deleting") continue;
        try {
          const res = await trackedFetch(
            `/proxy/obp/v6.0.0/banks/${selectedBankId}/api-products/${product.product_code}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const data = await res.json();
            const msg = data.message ?? "";
            // Ignore "not found" errors — product may not have been created
            if (!msg.includes("not found") && !msg.includes("OBP-30001")) {
              productErrors[product.id] = msg || `HTTP ${res.status}`;
            }
          }
        } catch {
          // Ignore — product may not exist
        }
        productStatus[product.id] = "idle";
      }
    } else {
      // No bank selected — just reset product statuses
      for (const product of collection.products) {
        productStatus[product.id] = "idle";
      }
    }

    // Step 2: Delete the collection
    const collectionId = collectionIds[collection.collection_name];
    if (collectionId) {
      try {
        const res = await trackedFetch(
          `/backend/api-collections/${collectionId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = await res.json();
          collectionStatus[collection.id] = "error";
          collectionErrors[collection.id] = data.message ?? `HTTP ${res.status}`;
          toast.error("Delete Error", collectionErrors[collection.id]);
          return;
        }
      } catch (err) {
        collectionStatus[collection.id] = "error";
        const msg = err instanceof Error ? err.message : "Delete failed";
        collectionErrors[collection.id] = msg;
        toast.error("Delete Error", msg);
        return;
      }
      delete collectionIds[collection.collection_name];
    }

    collectionStatus[collection.id] = "idle";
    toast.success("Deleted", `"${collection.collection_name}" and its products removed`);
  }

  function statusBadgeClass(status: ItemStatus): string {
    switch (status) {
      case "creating":
        return "badge-creating";
      case "deleting":
        return "badge-deleting";
      case "created":
        return "badge-created";
      case "error":
        return "badge-error";
      default:
        return "badge-idle";
    }
  }

  function canCreateProduct(collection: BootstrapCollection, product: BootstrapProduct): boolean {
    return (
      selectedBankId !== "" &&
      collectionStatus[collection.id] === "created" &&
      productStatus[product.id] !== "creating" &&
      productStatus[product.id] !== "created" &&
      productStatus[product.id] !== "deleting"
    );
  }
</script>

<svelte:head>
  <title>Bootstrap Reference Journeys - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6">
    <a href="/products" class="breadcrumb-link">API Products</a>
    <span class="breadcrumb-separator">&gt;</span>
    <span class="breadcrumb-current">Bootstrap</span>
  </nav>

  <div class="panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <Rocket size={32} />
        </div>
        <div>
          <h1 class="panel-title">Bootstrap Reference Journeys</h1>
          <div class="panel-subtitle">
            Create pre-defined API Collections and Products representing
            commercial banking journeys
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <!-- Info Banner -->
      <div class="info-banner">
        <Info size={18} />
        <div>
          <strong>What does bootstrapping do?</strong> It creates API Collections
          (with their endpoints) and API Products (linked via attributes) in one
          click. Collections group the endpoints; Products are what TPPs subscribe
          to. You can customise everything afterwards.
        </div>
      </div>

      {#if !selectedBankId}
        <div class="info-banner" style="border-color: #fbbf24; background: #fef3c7; color: #92400e;">
          <Info size={18} />
          <div>
            <strong>No bank selected.</strong> Please select a bank in <a href="/user" style="text-decoration: underline;">My Account</a> before creating products. Collections can be created without a bank.
          </div>
        </div>
      {/if}

      <!-- Progress Bar -->
      <div class="progress-bar">
        <div class="progress-item">
          <span class="progress-label">Collections</span>
          <span class="progress-value">{collectionsCreated} / {bootstrapJourneys.length}</span>
          <div class="progress-track">
            <div
              class="progress-fill collections-fill"
              style="width: {bootstrapJourneys.length > 0 ? (collectionsCreated / bootstrapJourneys.length) * 100 : 0}%"
            ></div>
          </div>
        </div>
        <div class="progress-item">
          <span class="progress-label">Products</span>
          <span class="progress-value">{productsCreated} / {totalProducts}</span>
          <div class="progress-track">
            <div
              class="progress-fill products-fill"
              style="width: {totalProducts > 0 ? (productsCreated / totalProducts) * 100 : 0}%"
            ></div>
          </div>
        </div>
      </div>

      <!-- Collection Cards -->
      <div class="collections-list">
        {#each bootstrapJourneys as collection (collection.id)}
          {@const cStatus = collectionStatus[collection.id] || "idle"}
          <div class="collection-card">
            <!-- Collection Header -->
            <div class="collection-header">
              <div class="collection-info">
                <div class="collection-title-row">
                  <h2 class="collection-name">{collection.collection_name.replaceAll("-", " ")}</h2>
                  <span class="badge {statusBadgeClass(cStatus)}">
                    {#if cStatus === "creating" || cStatus === "deleting"}
                      <Loader2 size={12} class="animate-spin" />
                    {:else if cStatus === "created"}
                      <Check size={12} />
                    {:else if cStatus === "error"}
                      <AlertCircle size={12} />
                    {/if}
                    {cStatus}
                  </span>
                </div>
                <p class="collection-desc">{collection.description}</p>
                <div class="scope-pills">
                  {#each collection.functional_scope as scope}
                    <span class="scope-pill">{scope}</span>
                  {/each}
                </div>
                {#if cStatus === "error" && collectionErrors[collection.id]}
                  <div class="inline-error">{collectionErrors[collection.id]}</div>
                {/if}
              </div>
              <div class="collection-actions">
                <button
                  class="btn-sm btn-primary"
                  disabled={cStatus === "creating" || cStatus === "created" || cStatus === "deleting"}
                  onclick={() => createCollection(collection)}
                >
                  {#if cStatus === "creating"}
                    Creating...
                  {:else if cStatus === "created"}
                    Created
                  {:else}
                    Create Collection
                  {/if}
                </button>
                <button
                  class="btn-sm btn-outline"
                  disabled={isAnyBusy || !selectedBankId || (cStatus === "created" && collection.products.every(p => productStatus[p.id] === "created"))}
                  onclick={() => createAllForCollection(collection)}
                >
                  Create All
                </button>
                {#if cStatus === "created" || cStatus === "error"}
                  <button
                    class="btn-sm btn-danger"
                    disabled={isAnyBusy}
                    onclick={() => deleteCollectionAndProducts(collection)}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                {/if}
                {#if cStatus === "deleting"}
                  <button class="btn-sm btn-danger" disabled>
                    <Loader2 size={12} class="animate-spin" />
                    Deleting...
                  </button>
                {/if}
              </div>
            </div>

            <!-- Expandable Endpoints -->
            <button
              class="endpoints-toggle"
              onclick={() => toggleExpand(collection.id)}
            >
              {#if expandedCollections[collection.id]}
                <ChevronDown size={16} />
              {:else}
                <ChevronRight size={16} />
              {/if}
              <span>{collection.endpoints.length} Endpoints</span>
            </button>

            {#if expandedCollections[collection.id]}
              <div class="endpoints-list">
                {#each collection.endpoints as ep}
                  <div class="endpoint-row">
                    <code class="endpoint-opid">{ep.operation_id}</code>
                    <span class="endpoint-summary">{ep.summary}</span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Products -->
            <div class="products-section">
              <div class="products-header">Products</div>
              {#each collection.products as product (product.id)}
                {@const pStatus = productStatus[product.id] || "idle"}
                <div class="product-row">
                  <div class="product-info">
                    <div class="product-title-row">
                      <span class="product-name">{product.name}</span>
                      <code class="product-code">{product.product_code}</code>
                      <span class="badge badge-sm {statusBadgeClass(pStatus)}">
                        {#if pStatus === "creating" || pStatus === "deleting"}
                          <Loader2 size={10} class="animate-spin" />
                        {:else if pStatus === "created"}
                          <Check size={10} />
                        {:else if pStatus === "error"}
                          <AlertCircle size={10} />
                        {/if}
                        {pStatus}
                      </span>
                    </div>
                    <p class="product-desc">{product.description}</p>
                    <div class="capabilities">
                      {#each product.capabilities as cap}
                        <span class="capability-pill">{cap}</span>
                      {/each}
                    </div>
                    {#if pStatus === "error" && productErrors[product.id]}
                      <div class="inline-error">{productErrors[product.id]}</div>
                    {/if}
                  </div>
                  <button
                    class="btn-sm btn-secondary"
                    disabled={!canCreateProduct(collection, product)}
                    onclick={() => createProduct(collection, product)}
                  >
                    {#if pStatus === "creating"}
                      Creating...
                    {:else if pStatus === "deleting"}
                      Deleting...
                    {:else if pStatus === "created"}
                      Created
                    {:else if !selectedBankId}
                      Select Bank
                    {:else if cStatus !== "created"}
                      Collection First
                    {:else}
                      Create Product
                    {/if}
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Bootstrap All Button -->
      <div class="bootstrap-all-section">
        <button
          class="btn-lg btn-primary"
          disabled={isAnyBusy || !selectedBankId || allDone}
          onclick={bootstrapAll}
        >
          <Rocket size={18} />
          {#if allDone}
            All Journeys Bootstrapped
          {:else if isAnyCreating}
            Bootstrapping...
          {:else}
            Bootstrap All Journeys
          {/if}
        </button>
        {#if !selectedBankId}
          <span class="bootstrap-hint">Select a bank in <a href="/user" style="text-decoration: underline; color: inherit;">My Account</a> to enable full bootstrap</span>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
  }

  /* ── Breadcrumb ─────────────────────────────────────────────────── */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .breadcrumb-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: rgb(var(--color-primary-400));
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .breadcrumb-separator {
    color: var(--color-surface-500);
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .breadcrumb-current {
    color: var(--color-surface-400);
  }

  /* ── Panel ──────────────────────────────────────────────────────── */
  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: #fef3c7;
    color: #d97706;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(217, 119, 6, 0.2);
    color: #fbbf24;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Info Banner ────────────────────────────────────────────────── */
  .info-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #1e40af;
    line-height: 1.5;
  }

  .info-banner :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }

  :global([data-mode="dark"]) .info-banner {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: rgb(var(--color-primary-200));
  }

  /* ── Progress Bar ───────────────────────────────────────────────── */
  .progress-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .progress-bar {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  .progress-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .progress-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .progress-label {
    color: var(--color-surface-200);
  }

  .progress-value {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .progress-value {
    color: var(--color-surface-400);
  }

  .progress-track {
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .progress-track {
    background: rgb(var(--color-surface-600));
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .collections-fill {
    background: #3b82f6;
  }

  .products-fill {
    background: #10b981;
  }

  /* ── Collections List ───────────────────────────────────────────── */
  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .collection-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .collection-card {
    border-color: rgb(var(--color-surface-600));
  }

  .collection-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .collection-header {
    background: rgb(var(--color-surface-700));
  }

  .collection-info {
    flex: 1;
    min-width: 0;
  }

  .collection-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .collection-name {
    font-size: 1.0625rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .collection-name {
    color: var(--color-surface-100);
  }

  .collection-desc {
    font-size: 0.8125rem;
    color: #4b5563;
    margin: 0.375rem 0 0.5rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .collection-desc {
    color: var(--color-surface-300);
  }

  .collection-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Scope & Capability Pills ───────────────────────────────────── */
  .scope-pills,
  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .scope-pill {
    padding: 0.125rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .scope-pill {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .capability-pill {
    padding: 0.125rem 0.5rem;
    background: #f3f4f6;
    color: #374151;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .capability-pill {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  /* ── Badges ─────────────────────────────────────────────────────── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .badge-sm {
    font-size: 0.625rem;
    padding: 0.0625rem 0.375rem;
  }

  .badge-idle {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .badge-idle {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  .badge-creating {
    background: #dbeafe;
    color: #2563eb;
  }

  :global([data-mode="dark"]) .badge-creating {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .badge-created {
    background: #d1fae5;
    color: #059669;
  }

  :global([data-mode="dark"]) .badge-created {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .badge-error {
    background: #fee2e2;
    color: #dc2626;
  }

  :global([data-mode="dark"]) .badge-error {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .badge-deleting {
    background: #fef3c7;
    color: #d97706;
  }

  :global([data-mode="dark"]) .badge-deleting {
    background: rgba(217, 119, 6, 0.2);
    color: #fbbf24;
  }

  /* ── Endpoints Toggle & List ────────────────────────────────────── */
  .endpoints-toggle {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.625rem 1.25rem;
    border: none;
    border-top: 1px solid #e5e7eb;
    background: transparent;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s;
  }

  .endpoints-toggle:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .endpoints-toggle {
    border-top-color: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .endpoints-toggle:hover {
    background: rgb(var(--color-surface-700));
  }

  .endpoints-list {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  :global([data-mode="dark"]) .endpoints-list {
    border-top-color: rgb(var(--color-surface-600));
  }

  .endpoint-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .endpoint-opid {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    color: #4b5563;
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .endpoint-opid {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-300);
  }

  .endpoint-summary {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .endpoint-summary {
    color: var(--color-surface-400);
  }

  /* ── Products Section ───────────────────────────────────────────── */
  .products-section {
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .products-section {
    border-top-color: rgb(var(--color-surface-600));
  }

  .products-header {
    padding: 0.625rem 1.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .products-header {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .product-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .product-row:last-child {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .product-row {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .product-info {
    flex: 1;
    min-width: 0;
  }

  .product-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .product-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .product-name {
    color: var(--color-surface-100);
  }

  .product-code {
    font-family: monospace;
    font-size: 0.6875rem;
    background: #f3f4f6;
    padding: 0.0625rem 0.375rem;
    border-radius: 4px;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .product-code {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  .product-desc {
    font-size: 0.75rem;
    color: #4b5563;
    margin: 0.25rem 0 0.375rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .product-desc {
    color: var(--color-surface-300);
  }

  /* ── Inline Error ───────────────────────────────────────────────── */
  .inline-error {
    margin-top: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .inline-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* ── Buttons ────────────────────────────────────────────────────── */
  .btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-lg {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-700));
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-500));
  }

  .btn-outline {
    background: transparent;
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  .btn-outline:hover:not(:disabled) {
    background: #eff6ff;
  }

  :global([data-mode="dark"]) .btn-outline {
    color: rgb(var(--color-primary-400));
    border-color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .btn-outline:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.1);
  }

  .btn-danger {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fecaca;
  }

  :global([data-mode="dark"]) .btn-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
  }

  :global([data-mode="dark"]) .btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
  }

  .btn-sm:disabled,
  .btn-lg:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Bootstrap All Section ──────────────────────────────────────── */
  .bootstrap-all-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .bootstrap-all-section {
    border-top-color: rgb(var(--color-surface-700));
  }

  .bootstrap-hint {
    font-size: 0.75rem;
    color: #d97706;
  }

  :global([data-mode="dark"]) .bootstrap-hint {
    color: #fbbf24;
  }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .collection-header {
      flex-direction: column;
    }

    .collection-actions {
      flex-direction: row;
    }

    .product-row {
      flex-direction: column;
    }

    .progress-bar {
      grid-template-columns: 1fr;
    }

    .bootstrap-all-section {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (max-width: 640px) {
    .header-content {
      flex-direction: column;
      text-align: center;
    }
  }

  /* ── Spin animation (for Loader2 icon) ──────────────────────────── */
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
