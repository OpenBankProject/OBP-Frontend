<script lang="ts">
  import { Loader2, Landmark, ArrowRightLeft } from "@lucide/svelte";
  import { page } from "$app/state";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface Currency {
    alphanumeric_code: string;
  }

  interface FxRate {
    bank_id: string;
    from_currency_code: string;
    to_currency_code: string;
    conversion_value: number;
    inverse_conversion_value: number;
    effective_date: string;
  }

  let currencies = $state<Currency[]>([]);
  let loadingCurrencies = $state(false);
  let currenciesError = $state<string | null>(null);

  let fromCurrency = $state("");
  let toCurrency = $state("");

  let fxRate = $state<FxRate | null>(null);
  let loadingRate = $state(false);
  let rateError = $state<string | null>(null);

  // Set bank from query param on first load
  $effect(() => {
    const bankIdParam = page.url.searchParams.get("bank_id");
    if (bankIdParam && bankIdParam !== currentBank.bankId) {
      currentBank.selectById(bankIdParam);
    }
  });

  async function fetchCurrencies(bankId: string) {
    if (!bankId) {
      currencies = [];
      currenciesError = null;
      return;
    }
    loadingCurrencies = true;
    currenciesError = null;
    fxRate = null;
    rateError = null;
    fromCurrency = "";
    toCurrency = "";
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/currencies`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch currencies");
      }
      const data = await res.json();
      currencies = (data.currencies || []).sort(
        (a: Currency, b: Currency) => a.alphanumeric_code.localeCompare(b.alphanumeric_code),
      );
    } catch (err) {
      currenciesError =
        err instanceof Error ? err.message : "Failed to fetch currencies";
      currencies = [];
    } finally {
      loadingCurrencies = false;
    }
  }

  // Re-fetch currencies when bank changes
  $effect(() => {
    const bankId = currentBank.bankId;
    fetchCurrencies(bankId);
  });

  async function fetchFxRate() {
    if (!currentBank.bankId || !fromCurrency || !toCurrency) return;
    loadingRate = true;
    rateError = null;
    fxRate = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(currentBank.bankId)}/fx/${encodeURIComponent(fromCurrency)}/${encodeURIComponent(toCurrency)}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch FX rate");
      }
      fxRate = await res.json();
    } catch (err) {
      rateError =
        err instanceof Error ? err.message : "Failed to fetch FX rate";
    } finally {
      loadingRate = false;
    }
  }

  function swapCurrencies() {
    const temp = fromCurrency;
    fromCurrency = toCurrency;
    toCurrency = temp;
    fxRate = null;
    rateError = null;
  }
</script>

<svelte:head>
  <title>FX Rates - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">FX Rates</h1>
          <div class="panel-subtitle">
            {#if currentBank.bankId}
              Exchange rates at bank <strong>{currentBank.bankId}</strong>
            {:else}
              Select a bank to look up exchange rates
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if !currentBank.bankId}
        <div class="empty-state">
          <div class="empty-icon">
            <Landmark size={48} />
          </div>
          <h4 class="empty-title">No Bank Selected</h4>
          <p class="empty-description">
            Please <a href="/user">select a bank</a> to look up FX rates.
          </p>
        </div>
      {:else if loadingCurrencies}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading currencies...</p>
        </div>
      {:else if currenciesError}
        <div class="error-state">
          <p class="error-message">{currenciesError}</p>
        </div>
      {:else if currencies.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <ArrowRightLeft size={48} />
          </div>
          <h4 class="empty-title">No Currencies</h4>
          <p class="empty-description">
            No currencies found for this bank.
          </p>
        </div>
      {:else}
        <!-- Currency Selection -->
        <div class="fx-form">
          <div class="currency-row">
            <div class="currency-field">
              <label for="from-currency" class="field-label">From</label>
              <select id="from-currency" class="currency-select" bind:value={fromCurrency}>
                <option value="">Select currency</option>
                {#each currencies as currency}
                  <option value={currency.alphanumeric_code}>{currency.alphanumeric_code}</option>
                {/each}
              </select>
            </div>

            <button
              type="button"
              class="swap-button"
              onclick={swapCurrencies}
              disabled={!fromCurrency && !toCurrency}
              aria-label="Swap currencies"
            >
              <ArrowRightLeft size={20} />
            </button>

            <div class="currency-field">
              <label for="to-currency" class="field-label">To</label>
              <select id="to-currency" class="currency-select" bind:value={toCurrency}>
                <option value="">Select currency</option>
                {#each currencies as currency}
                  <option value={currency.alphanumeric_code}>{currency.alphanumeric_code}</option>
                {/each}
              </select>
            </div>

            <div class="action-field">
              <button
                type="button"
                class="get-rate-button"
                onclick={fetchFxRate}
                disabled={!fromCurrency || !toCurrency || loadingRate}
              >
                {#if loadingRate}
                  <Loader2 size={16} class="spinner-icon" />
                  Loading...
                {:else}
                  Get Rate
                {/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Rate Error -->
        {#if rateError}
          <div class="error-state">
            <p class="error-message">{rateError}</p>
          </div>
        {/if}

        <!-- Rate Result -->
        {#if fxRate}
          <div class="rate-result">
            <div class="rate-header">
              <span class="rate-pair">{fxRate.from_currency_code} / {fxRate.to_currency_code}</span>
            </div>
            <div class="rate-grid">
              <div class="rate-card">
                <div class="rate-card-label">Conversion Rate</div>
                <div class="rate-card-value">{fxRate.conversion_value}</div>
                <div class="rate-card-detail">
                  1 {fxRate.from_currency_code} = {fxRate.conversion_value} {fxRate.to_currency_code}
                </div>
              </div>
              <div class="rate-card">
                <div class="rate-card-label">Inverse Rate</div>
                <div class="rate-card-value">{fxRate.inverse_conversion_value}</div>
                <div class="rate-card-detail">
                  1 {fxRate.to_currency_code} = {fxRate.inverse_conversion_value} {fxRate.from_currency_code}
                </div>
              </div>
              <div class="rate-card">
                <div class="rate-card-label">Effective Date</div>
                <div class="rate-card-value rate-card-date">{fxRate.effective_date}</div>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 900px;
  }

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
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
  }

  /* FX Form */
  .fx-form {
    margin-bottom: 1.5rem;
  }

  .currency-row {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .currency-field {
    flex: 1;
    min-width: 150px;
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .field-label {
    color: var(--color-surface-400);
  }

  .currency-select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    color: #111827;
    transition: all 0.2s;
  }

  .currency-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .currency-select {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .currency-select:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .swap-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .swap-button:hover:not(:disabled) {
    background: #f3f4f6;
    color: #374151;
    border-color: #9ca3af;
  }

  .swap-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .swap-button {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .swap-button:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  .action-field {
    flex-shrink: 0;
  }

  .get-rate-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .get-rate-button:hover:not(:disabled) {
    background: #5a6fd6;
  }

  .get-rate-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Rate Result */
  .rate-result {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .rate-result {
    border-color: rgb(var(--color-surface-700));
  }

  .rate-header {
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .rate-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .rate-pair {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .rate-pair {
    color: var(--color-surface-100);
  }

  .rate-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1px;
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .rate-grid {
    background: rgb(var(--color-surface-700));
  }

  .rate-card {
    padding: 1.25rem 1.5rem;
    background: white;
  }

  :global([data-mode="dark"]) .rate-card {
    background: rgb(var(--color-surface-800));
  }

  .rate-card-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .rate-card-label {
    color: var(--color-surface-400);
  }

  .rate-card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .rate-card-value {
    color: var(--color-surface-100);
  }

  .rate-card-date {
    font-size: 1rem;
  }

  .rate-card-detail {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .rate-card-detail {
    color: var(--color-surface-400);
  }

  /* Empty/Loading/Error states */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .empty-icon {
    color: var(--color-surface-600);
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #4a5568;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-description {
    margin: 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
    color: var(--color-surface-400);
  }

  .loading-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  :global([data-mode="dark"]) .loading-state {
    color: var(--color-surface-400);
  }

  .loading-state :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  .get-rate-button :global(.spinner-icon) {
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

  .error-state {
    padding: 1rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    margin: 1rem 0;
  }

  :global([data-mode="dark"]) .error-state {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
  }

  .error-message {
    color: #991b1b;
    font-size: 0.875rem;
    margin: 0;
  }

  :global([data-mode="dark"]) .error-message {
    color: rgb(var(--color-error-300));
  }

  @media (max-width: 640px) {
    .panel-content {
      padding: 1rem;
    }

    .currency-row {
      flex-direction: column;
      align-items: stretch;
    }

    .swap-button {
      align-self: center;
    }

    .action-field {
      width: 100%;
    }

    .get-rate-button {
      width: 100%;
      justify-content: center;
    }
  }
</style>
