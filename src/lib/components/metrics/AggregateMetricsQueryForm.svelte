<script lang="ts">
  interface Props {
    queryForm: {
      from_date: string;
      to_date: string;
      consumer_id: string;
      user_id: string;
      username: string;
      anon: string;
      url: string;
      app_name: string;
      implemented_by_partial_function: string;
      implemented_in_version: string;
      verb: string;
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
  }: Props = $props();

  function handleFieldChange() {
    onFieldChange();
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSubmit();
  }
</script>

<form onsubmit={handleSubmit} class="qf">
  <div class="qf-bar">
    <label class="qf-inline qf-sm"><span>Verb</span>
      <select bind:value={queryForm.verb} onchange={handleFieldChange} name="verb" data-testid="verb">
        <option value="">All</option>
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DEL</option>
        <option value="PATCH">PATCH</option>
      </select>
    </label>
    <label class="qf-inline qf-sm"><span>Code</span>
      <select bind:value={queryForm.http_status_code} onchange={handleFieldChange} name="http_status_code" data-testid="http-status-code">
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
    <label class="qf-inline qf-sm"><span>Anon</span>
      <select bind:value={queryForm.anon} onchange={handleFieldChange} name="anon" data-testid="anon">
        <option value="">All</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  </div>
  <div class="qf-bar qf-filters">
    <label class="qf-inline"><span>App</span>
      <input type="text" bind:value={queryForm.app_name} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="name" name="app_name" data-testid="app-name" />
    </label>
    <label class="qf-inline"><span>Apps</span>
      <input type="text" bind:value={queryForm.include_app_names} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="csv" name="include_app_names" data-testid="include-app-names" />
    </label>
    <label class="qf-inline"><span>User</span>
      <input type="text" bind:value={queryForm.username} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="username" name="username" data-testid="username" />
    </label>
    <label class="qf-inline"><span>User ID</span>
      <input type="text" bind:value={queryForm.user_id} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ID" name="user_id" data-testid="user-id" />
    </label>
    <label class="qf-inline"><span>Consumer</span>
      <input type="text" bind:value={queryForm.consumer_id} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ID" name="consumer_id" data-testid="consumer-id" />
    </label>
    <label class="qf-inline"><span>URL</span>
      <input type="text" bind:value={queryForm.url} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="path" name="url" data-testid="url" />
    </label>
    <label class="qf-inline"><span>Fn</span>
      <input type="text" bind:value={queryForm.implemented_by_partial_function} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="partial fn" name="implemented_by_partial_function" data-testid="partial-function" />
    </label>
    <label class="qf-inline qf-sm"><span>Ver</span>
      <input type="text" bind:value={queryForm.implemented_in_version} onblur={handleFieldChange} onchange={handleFieldChange} placeholder="ver" name="implemented_in_version" data-testid="version" />
    </label>
    {#if showAutoRefresh}
      <label class="qf-inline qf-sm"><span>Auto</span>
        <select bind:value={autoRefresh} name="auto_refresh" data-testid="auto-refresh">
          <option value="5">5s</option>
          <option value="10">10s</option>
          <option value="30">30s</option>
          <option value="60">1m</option>
          <option value="300">5m</option>
          <option value="none">Off</option>
        </select>
      </label>
    {/if}
    {#if showRefreshButton}
      <button type="button" class="qf-btn" onclick={onRefresh} data-testid="refresh-btn">Refresh</button>
    {/if}
    {#if showClearButton}
      <button type="button" class="qf-btn" onclick={onClear} data-testid="clear-btn">Clear</button>
    {/if}
    <button type="submit" hidden>Submit</button>
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
    user-select: none;
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

  .qf-inline input[type="text"] {
    width: 6rem;
  }

  .qf-sm select,
  .qf-sm input {
    width: 4.5rem;
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

  @media (max-width: 768px) {
    .qf-inline input[type="datetime-local"] {
      width: 9rem;
    }

    .qf-inline input[type="text"] {
      width: 5rem;
    }
  }
</style>
