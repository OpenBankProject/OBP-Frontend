<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    queryForm: {
      from_date: string;
      to_date: string;
      limit: string;
      offset: string;
      sort_by: string;
      direction: string;
      consumer_id: string;
      user_id: string;
      username: string;
      anon: string;
      url: string;
      app_name: string;
      implemented_by_partial_function: string;
      implemented_in_version: string;
      verb: string;
      correlation_id: string;
      duration: string;
      include_app_names: string;
      http_status_code: string;
    };
    autoRefresh?: string;
    onFieldChange?: () => void;
    onClear?: () => void;
    onRefresh?: () => void;
    onSubmit?: () => void;
    showAutoRefresh?: boolean;
    showClearButton?: boolean;
    showRefreshButton?: boolean;
    filtersExpanded?: boolean;
    headerActions?: Snippet;
    transport?: "rest" | "grpc";
  }

  let {
    queryForm = $bindable(),
    autoRefresh = $bindable("none"),
    onFieldChange = () => {},
    onClear = () => {},
    onRefresh = () => {},
    onSubmit = () => {},
    showAutoRefresh = true,
    showClearButton = true,
    showRefreshButton = true,
    filtersExpanded = $bindable(false),
    headerActions,
    transport = "rest",
  }: Props = $props();

  const isGrpc = $derived(transport === "grpc");
  const grpcUnsupported = "Not applicable on gRPC stream";

  function handleFieldChange() {
    onFieldChange();
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSubmit();
  }
</script>

<form onsubmit={handleSubmit} class="qf">
  {#if !isGrpc}
    <!-- Row 1: time range, pagination, sort (REST only) -->
    <div class="qf-bar qf-filters">
      <label class="qf-inline"><span>From</span>
        <input type="datetime-local" bind:value={queryForm.from_date} onblur={handleFieldChange} onchange={handleFieldChange} step="1" name="from_date" />
      </label>
      <label class="qf-inline"><span>To</span>
        <input type="datetime-local" bind:value={queryForm.to_date} onblur={handleFieldChange} onchange={handleFieldChange} step="1" name="to_date" />
      </label>
      <label class="qf-inline qf-xs"><span>Limit</span>
        <input type="number" bind:value={queryForm.limit} min="1" max="10000" onblur={handleFieldChange} onchange={handleFieldChange} name="limit" />
      </label>
      <label class="qf-inline qf-xs"><span>Offset</span>
        <input type="number" bind:value={queryForm.offset} min="0" onblur={handleFieldChange} onchange={handleFieldChange} name="offset" />
      </label>
      <label class="qf-inline qf-sm"><span>Sort</span>
        <select bind:value={queryForm.sort_by} onchange={handleFieldChange} name="sort_by">
          <option value="date">Date</option>
          <option value="url">URL</option>
          <option value="username">User</option>
          <option value="app_name">App</option>
          <option value="verb">Method</option>
          <option value="developer_email">Dev Email</option>
          <option value="consumer_id">Consumer</option>
          <option value="implemented_by_partial_function">Fn</option>
          <option value="implemented_in_version">Ver</option>
        </select>
      </label>
      <label class="qf-inline qf-xs"><span>Dir</span>
        <select bind:value={queryForm.direction} onchange={handleFieldChange} name="direction">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </label>
    </div>
  {/if}

  <!-- Row 2: match filters (server-side) -->
  <div class="qf-bar qf-filters">
    <label class="qf-inline qf-sm"><span>Verb</span>
      <select bind:value={queryForm.verb} onchange={handleFieldChange} name="verb">
        <option value="">All</option>
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DEL</option>
        <option value="PATCH">PATCH</option>
      </select>
    </label>
    <label class="qf-inline qf-sm"><span>Code</span>
      <select bind:value={queryForm.http_status_code} onchange={handleFieldChange} name="http_status_code">
        <option value="">All</option>
        <option value="200">200</option>
        <option value="201">201</option>
        <option value="204">204</option>
        <option value="400">400</option>
        <option value="401">401</option>
        <option value="403">403</option>
        <option value="404">404</option>
        <option value="500">500</option>
        <option value="502">502</option>
        <option value="503">503</option>
      </select>
    </label>
    <label class="qf-inline"><span>Consumer</span>
      <input type="text" bind:value={queryForm.consumer_id} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ID" name="consumer_id" />
    </label>
    <label class="qf-inline"><span>App</span>
      <input type="text" bind:value={queryForm.app_name} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="name" name="app_name" />
    </label>
    <label class="qf-inline"><span>Fn</span>
      <input type="text" bind:value={queryForm.implemented_by_partial_function} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="partial fn" name="implemented_by_partial_function" />
    </label>
  </div>

  <!-- Row 3: extra filters -->
  <div class="qf-bar qf-filters">
    {#if !isGrpc}
      <label class="qf-inline"><span>Apps</span>
        <input type="text" bind:value={queryForm.include_app_names} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="csv" name="include_app_names" />
      </label>
      <label class="qf-inline"><span>User</span>
        <input type="text" bind:value={queryForm.username} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ID" name="username" />
      </label>
      <label class="qf-inline qf-sm"><span>Ver</span>
        <input type="text" bind:value={queryForm.implemented_in_version} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ver" name="implemented_in_version" />
      </label>
    {/if}
    <label class="qf-inline qf-sm"><span>Min Duration</span>
      <input type="number" bind:value={queryForm.duration} min="0" onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ms" name="duration" />
    </label>
    {#if !isGrpc}
      <label class="qf-inline qf-sm"><span>Anon</span>
        <select bind:value={queryForm.anon} onchange={handleFieldChange} name="anon">
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    {/if}
    <button type="submit" hidden>Submit</button>
    {#if showClearButton}
      <div class="qf-actions">
        <button type="button" class="qf-btn" onclick={onClear} title="Clear form">🗑️ Clear</button>
      </div>
    {/if}
  </div>
</form>

<style>
  .qf {
    width: 100%;
  }

  .qf-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding: 0.35rem 0.5rem;
    background: var(--color-surface-100);
    border: 1px solid var(--color-surface-300);
    border-radius: 0.25rem;
  }

  :global([data-mode="dark"]) .qf-bar {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }

  .qf-filters {
    margin-top: 0.25rem;
  }

  .qf-divider {
    color: var(--color-surface-300);
    user-select: none;
  }

  :global([data-mode="dark"]) .qf-divider {
    color: rgb(var(--color-surface-600));
  }

  .qf-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    cursor: default;
  }

  .qf-inline span {
    color: var(--color-surface-500);
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .qf-inline span {
    color: var(--color-surface-400);
  }

  .qf-inline input,
  .qf-inline select {
    padding: 0.2rem 0.3rem;
    border: 1px solid var(--color-surface-300);
    border-radius: 0.2rem;
    font-size: 0.8rem;
    background: white;
    color: var(--color-surface-900);
    line-height: 1.2;
  }

  :global([data-mode="dark"]) .qf-inline input,
  :global([data-mode="dark"]) .qf-inline select {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .qf-inline input:focus,
  .qf-inline select:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .qf-inline input[type="datetime-local"] {
    width: 11rem;
  }

  .qf-inline input[type="number"] {
    width: 3.5rem;
  }

  .qf-inline input[type="text"] {
    width: 6rem;
  }

  .qf-tiny input[type="number"] {
    width: 3rem;
  }

  .qf-xs select {
    width: 3.5rem;
  }

  .qf-sm select,
  .qf-sm input {
    width: 4.5rem;
  }

  .qf-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: auto;
  }

  .qf-btn {
    padding: 0.2rem 0.4rem;
    font-size: 0.8rem;
    background: transparent;
    border: 1px solid var(--color-surface-300);
    border-radius: 0.2rem;
    cursor: pointer;
    color: var(--color-surface-600);
    white-space: nowrap;
  }

  .qf-btn:hover {
    background: var(--color-surface-200);
    color: var(--color-surface-800);
  }

  :global([data-mode="dark"]) .qf-btn {
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .qf-btn:hover {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .qf-sel {
    padding: 0.2rem 0.3rem;
    font-size: 0.8rem;
    border: 1px solid var(--color-surface-300);
    border-radius: 0.2rem;
    background: white;
    color: var(--color-surface-700);
  }

  :global([data-mode="dark"]) .qf-sel {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-300);
  }

  @media (max-width: 768px) {
    .qf-inline input[type="datetime-local"] {
      width: 9rem;
    }

    .qf-inline input[type="text"] {
      width: 5rem;
    }
  }
</style>
