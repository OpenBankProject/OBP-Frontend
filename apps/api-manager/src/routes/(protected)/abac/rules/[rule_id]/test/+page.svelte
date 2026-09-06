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
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import {
    Shield,
    Edit,
    ArrowLeft,
    Play,
    AlertCircle,
    CheckCircle,
    XCircle,
    Code,
    Info,
  } from "@lucide/svelte";

  let {
    data,
  }: {
    data: PageData & {
      rule: any;
      ruleId: string;
      userEntitlements: any[];
      requiredRoles: any[];
    };
  } = $props();

  // Parameter management
  let parameters = $state<Record<string, any>>({});
  let executeResult = $state<any>(null);
  let executeError = $state<string>("");
  let isExecuting = $state(false);

  // Common parameter names for ABAC rules
  const commonParameters = [
    { name: "user.user_id", type: "string", description: "User ID" },
    {
      name: "user.emailAddress",
      type: "string",
      description: "User email address",
    },
    { name: "user.bank_id", type: "string", description: "User's bank ID" },
    {
      name: "account.owner_id",
      type: "string",
      description: "Account owner ID",
    },
    {
      name: "account.bank_id",
      type: "string",
      description: "Account's bank ID",
    },
    {
      name: "resource.bank_id",
      type: "string",
      description: "Resource bank ID",
    },
  ];

  // Extract parameter names from rule code
  function extractParametersFromCode(code: string): string[] {
    const paramPattern =
      /\b(AuthenticatedUser|OnBehalfOfUser|Context|User|Bank|Account|View|Transaction|Customer)\.\w+(\.\w+)*/g;
    const matches = code.match(paramPattern) || [];
    return [...new Set(matches)];
  }

  let detectedParameters = $derived.by(() => {
    if (data.rule?.rule_code) {
      return extractParametersFromCode(data.rule.rule_code);
    }
    return [];
  });

  // Initialize parameters from detected ones
  $effect(() => {
    if (detectedParameters.length > 0) {
      const newParams: Record<string, any> = {};
      detectedParameters.forEach((param) => {
        if (!(param in parameters)) {
          newParams[param] = "";
        }
      });
      parameters = { ...parameters, ...newParams };
    }
  });

  async function handleExecute() {
    executeError = "";
    executeResult = null;
    isExecuting = true;

    try {
      // Build the execution payload
      const payload = {
        parameters: parameters,
      };

      // Call the execute API endpoint
      const response = await fetch(`/backend/abac-rules/${data.ruleId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      executeResult = result;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to execute ABAC rule";
      executeError = errorMsg;
    } finally {
      isExecuting = false;
    }
  }

  function handleEdit() {
    goto(`/abac/rules/${data.ruleId}/edit`);
  }

  function handleBack() {
    goto("/abac/rules");
  }

  // Suggested properties for each top-level object
  // Only _id fields are needed for the execute endpoint
  const suggestedProperties: Record<string, string[]> = {
    AuthenticatedUser: ["user_id"],
    OnBehalfOfUser: ["user_id"],
    Context: ["context_id"],
    User: ["user_id"],
    Bank: ["bank_id"],
    Account: ["account_id"],
    View: ["view_id"],
    Transaction: ["transaction_id"],
    Customer: ["customer_id"],
  };

  function addTopLevelObject(topLevel: string) {
    const props = suggestedProperties[topLevel] || ["id", "name"];

    // Add common properties for this top-level object
    props.forEach((prop) => {
      const paramName = `${topLevel}.${prop}`;
      if (!(paramName in parameters)) {
        parameters[paramName] = "";
      }
    });
    parameters = { ...parameters };
  }

  function addCustomParameter(topLevel: string) {
    const propName = prompt(
      `Enter property name for ${topLevel} (e.g., custom_field):`,
    );
    if (propName && propName.trim()) {
      const paramName = `${topLevel}.${propName.trim()}`;
      parameters[paramName] = "";
      parameters = { ...parameters };
    }
  }

  function removeParameter(paramName: string) {
    const { [paramName]: removed, ...rest } = parameters;
    parameters = rest;
  }
</script>

<svelte:head>
  <title>Test ABAC Rule - API Manager II</title>
</svelte:head>

  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <button
        onclick={handleBack}
        class="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft size={16} />
        Back to Rules
      </button>
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Test Rule: {data.rule?.rule_name || "ABAC Rule"}
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Rule ID: {data.ruleId}
          </p>
        </div>
        <button onclick={handleEdit} class="btn-primary">
          <Edit size={16} />
          Edit Rule
        </button>
      </div>
    </div>

    <!-- Rule Details Panel - Full Width at Top -->
    <div class="panel">
      <div class="panel-header">
        <div class="flex items-center gap-2">
          <Shield size={18} />
          <h2 class="panel-title text-base">Rule Details</h2>
        </div>
      </div>
      <div class="panel-content">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Status -->
          <div>
            <div
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Status
            </div>
            <span
              class="status-badge-small {data.rule?.is_active
                ? 'status-active'
                : 'status-inactive'}"
            >
              {data.rule?.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <!-- Description -->
          {#if data.rule?.description}
            <div class="md:col-span-3">
              <div
                class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Description
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                {data.rule.description}
              </p>
            </div>
          {/if}
        </div>

        <!-- Rule Code - Full Width -->
        <div class="mt-4">
          <div
            class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Rule Code
          </div>
          <div
            class="code-block rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <pre class="overflow-x-auto text-xs"><code
                >{data.rule?.rule_code}</code
              ></pre>
          </div>
        </div>

        <!-- Detected Parameters -->
        {#if detectedParameters.length > 0}
          <div class="mt-4">
            <div
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Detected Parameters
            </div>
            <div class="flex flex-wrap gap-1">
              {#each detectedParameters as param}
                <span
                  class="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {param}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Test Execution Panel - Full Width Below -->
    <div class="panel">
      <div class="panel-header">
        <div class="flex items-center gap-2">
          <Play size={20} />
          <h2 class="panel-title">Test Execution</h2>
        </div>
      </div>
      <div class="panel-content">
        <!-- Parameters Form -->
        <div class="space-y-4">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Parameter Context
          </div>

          <!-- Top-level object selection -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onclick={() => addTopLevelObject("AuthenticatedUser")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">AU</div>
                <span>AuthenticatedUser</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("OnBehalfOfUser")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">OB</div>
                <span>OnBehalfOfUser</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("Context")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">C</div>
                <span>Context</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("User")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">U</div>
                <span>User</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("Bank")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">B</div>
                <span>Bank</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("Account")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">A</div>
                <span>Account</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("View")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">V</div>
                <span>View</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("Transaction")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">T</div>
                <span>Transaction</span>
              </div>
            </button>
            <button
              type="button"
              onclick={() => addTopLevelObject("Customer")}
              class="context-button"
            >
              <div class="flex items-center justify-center gap-2">
                <div class="context-icon">CU</div>
                <span>Customer</span>
              </div>
            </button>
          </div>

          <!-- Parameter inputs grouped by top-level object -->
          {#if Object.keys(parameters).length === 0}
            <div
              class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-900"
            >
              <Code class="mx-auto mb-2 text-gray-400" size={24} />
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Click a parameter context above to start adding test values
              </p>
            </div>
          {:else}
            {#each ["AuthenticatedUser", "OnBehalfOfUser", "Context", "User", "Bank", "Account", "View", "Transaction", "Customer"] as topLevel}
              {@const groupParams = Object.keys(parameters).filter((key) =>
                key.startsWith(topLevel + "."),
              )}
              {#if groupParams.length > 0}
                <div class="parameter-group">
                  <div class="parameter-group-header">
                    <span class="parameter-group-title">{topLevel}</span>
                    <button
                      type="button"
                      onclick={() => addCustomParameter(topLevel)}
                      class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      + Add {topLevel} property
                    </button>
                  </div>
                  <div class="space-y-2">
                    {#each groupParams as paramName}
                      <div class="parameter-input-row">
                        <label for={paramName} class="parameter-label">
                          {paramName.split(".").slice(1).join(".")}
                        </label>
                        <div class="flex gap-2 flex-1">
                          <input
                            id={paramName}
                            type="text"
                            bind:value={parameters[paramName]}
                            placeholder="Enter value..."
                            class="parameter-input"
                          />
                          <button
                            type="button"
                            onclick={() => removeParameter(paramName)}
                            class="remove-button"
                            title="Remove parameter"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}

          <!-- Execute Button -->
          <button
            onclick={handleExecute}
            disabled={isExecuting || Object.keys(parameters).length === 0}
            class="btn-execute"
          >
            {#if isExecuting}
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Executing...
            {:else}
              <Play size={16} />
              Execute Rule
            {/if}
          </button>

          <!-- Execution Results -->
          {#if executeError}
            <div
              class="result-box result-error flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            >
              <XCircle
                class="shrink-0 text-red-600 dark:text-red-400"
                size={20}
              />
              <div class="flex-1">
                <h4
                  class="text-sm font-semibold text-red-800 dark:text-red-200"
                >
                  Execution Failed
                </h4>
                <p class="mt-1 text-sm text-red-700 dark:text-red-300">
                  {executeError}
                </p>
              </div>
            </div>
          {/if}

          {#if executeResult}
            <div
              class="result-box result-success flex items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
            >
              <CheckCircle
                class="shrink-0 text-green-600 dark:text-green-400"
                size={20}
              />
              <div class="flex-1">
                <h4
                  class="text-sm font-semibold text-green-800 dark:text-green-200"
                >
                  Execution Result
                </h4>
                <div
                  class="mt-2 rounded border border-green-200 bg-white p-3 dark:border-green-700 dark:bg-gray-800"
                >
                  <pre
                    class="overflow-x-auto text-xs text-gray-800 dark:text-gray-200">{JSON.stringify(
                      executeResult,
                      null,
                      2,
                    )}</pre>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

<style>
  .container {
    max-width: 1400px;
  }

  .panel {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(31, 41, 55);
  }

  .panel-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(55, 65, 81);
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: #f9fafb;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary:hover {
    background: #2563eb;
  }

  .btn-execute {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-execute:hover:not(:disabled) {
    background: #059669;
  }

  .btn-execute:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status-badge-small {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .code-block {
    font-family: "Monaco", "Courier New", monospace;
  }

  .code-block code {
    color: #1f2937;
  }

  :global([data-mode="dark"]) .code-block code {
    color: #f9fafb;
  }

  .status-active {
    background: #10b981;
    color: #ffffff;
  }

  .status-inactive {
    background: #ef4444;
    color: #ffffff;
  }

  .context-button {
    padding: 0.75rem 1rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .context-button:hover {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #3b82f6;
  }

  :global([data-mode="dark"]) .context-button {
    background: rgb(31, 41, 55);
    border-color: rgb(55, 65, 81);
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .context-button:hover {
    border-color: #3b82f6;
    background: rgb(30, 58, 138);
    color: #3b82f6;
  }

  .context-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background: #dbeafe;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .context-icon {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .parameter-group {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .parameter-group {
    background: rgb(17, 24, 39);
    border-color: rgb(55, 65, 81);
  }

  .parameter-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .parameter-group-header {
    border-bottom-color: rgb(55, 65, 81);
  }

  .parameter-group-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .parameter-group-title {
    color: #f9fafb;
  }

  .parameter-input-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .parameter-label {
    min-width: 120px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .parameter-label {
    color: #9ca3af;
  }

  .parameter-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .parameter-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .parameter-input {
    background: rgb(31, 41, 55);
    border-color: rgb(75, 85, 99);
    color: #f9fafb;
  }

  .remove-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1.25rem;
    font-weight: 400;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-button:hover {
    background: #fee2e2;
    border-color: #ef4444;
    color: #ef4444;
  }

  :global([data-mode="dark"]) .remove-button {
    background: rgb(31, 41, 55);
    border-color: rgb(75, 85, 99);
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .remove-button:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .result-box {
    margin-top: 1rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .parameter-input-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .parameter-label {
      min-width: auto;
      width: 100%;
    }
  }
</style>
