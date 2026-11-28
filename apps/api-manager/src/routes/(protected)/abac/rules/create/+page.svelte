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
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { Code, AlertCircle, Info } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  // Form states matching the actual API structure
  let formRuleName = $state("");
  let formRuleCode = $state("");
  let formDescription = $state("");
  let formPolicy = $state("");
  let formIsActive = $state(true);
  let formError = $state("");
  let isSubmitting = $state(false);

  // Example rule codes for guidance
  const exampleRuleCodes = [
    {
      title: "Admin Only",
      code: 'user.emailAddress.contains("admin")',
      description: "Only allow users with admin in their email",
    },
    {
      title: "Owner Access",
      code: "user.user_id == account.owner_id",
      description: "Only allow account owners to access",
    },
    {
      title: "Role Based",
      code: 'user.hasRole("CanAccessAllAccounts")',
      description: "Check if user has specific role",
    },
    {
      title: "Bank Restriction",
      code: "user.bank_id == resource.bank_id",
      description: "Restrict to same bank as resource",
    },
  ];

  let showExamples = $state(false);

  function insertExample(code: string) {
    formRuleCode = code;
    showExamples = false;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formRuleName.trim()) {
      formError = "Rule name is required";
      return;
    }

    if (!formRuleCode.trim()) {
      formError = "Rule code is required";
      return;
    }

    if (!formPolicy.trim()) {
      formError = "Policy is required";
      return;
    }

    isSubmitting = true;
    formError = "";

    try {
      const requestBody: any = {
        rule_name: formRuleName,
        rule_code: formRuleCode,
        is_active: formIsActive,
      };

      if (formDescription.trim()) {
        requestBody.description = formDescription;
      }

      requestBody.policy = formPolicy;

      const response = await fetch("/backend/abac-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create ABAC rule",
        );
        logErrorDetails("Create ABAC Rule", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the rules list
      goto("/abac/rules");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create ABAC rule";
      formError = errorMsg;
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/abac/rules");
  }
</script>

<svelte:head>
  <title>Create ABAC Rule - API Manager II</title>
</svelte:head>

  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold ui-text">
        Create ABAC Rule
      </h1>
      <p class="mt-2 text-sm ui-muted">
        Create a new Attribute-Based Access Control rule with custom logic
      </p>
    </div>

    <div class="mx-auto max-w-3xl">
      <div
        class="rounded-lg p-6 shadow-md ui-card"
      >
        {#if formError}
          <div
            class="mb-4 flex items-start gap-3 rounded-lg border p-4 ui-tone-error"
          >
            <AlertCircle
              class="mt-0.5 flex-shrink-0 ui-text-error"
              size={20}
            />
            <p class="text-sm ui-text-error">{formError}</p>
          </div>
        {/if}

        <!-- Info Banner -->
        <div
          class="mb-6 flex items-start gap-3 rounded-lg border p-4 ui-tone-info"
        >
          <Info
            class="mt-0.5 flex-shrink-0 ui-link"
            size={20}
          />
          <div class="text-sm ui-link">
            <p class="font-medium">About ABAC Rules</p>
            <p class="mt-1">
              ABAC rules use code expressions to define access control logic.
              You can reference user attributes, resource properties, and use
              logical operators to create flexible authorization rules.
            </p>
          </div>
        </div>

        <form onsubmit={handleSubmit}>
          <div class="space-y-6">
            <!-- Rule Name Field -->
            <div>
              <label
                for="rule_name"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Rule Name <span class="ui-text-error">*</span>
              </label>
              <input
                id="rule_name"
                type="text"
                bind:value={formRuleName}
                required
                placeholder="e.g., admin_only"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              />
              <p class="mt-1 text-xs ui-muted">
                A unique identifier for this rule
              </p>
            </div>

            <!-- Rule Code Field -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <label
                  for="rule_code"
                  class="block text-sm font-medium ui-muted"
                >
                  Rule Code <span class="ui-text-error">*</span>
                </label>
                <button
                  type="button"
                  onclick={() => (showExamples = !showExamples)}
                  class="text-xs ui-link"
                >
                  {showExamples ? "Hide" : "Show"} Examples
                </button>
              </div>

              {#if showExamples}
                <div
                  class="mb-3 rounded-lg border p-4 ui-card ui-border"
                >
                  <p
                    class="mb-2 text-xs font-medium ui-muted"
                  >
                    Example Rule Codes:
                  </p>
                  <div class="space-y-2">
                    {#each exampleRuleCodes as example}
                      <div
                        class="rounded border p-2 ui-card ui-border"
                      >
                        <div class="mb-1 flex items-center justify-between">
                          <span
                            class="text-xs font-medium ui-muted"
                          >
                            {example.title}
                          </span>
                          <button
                            type="button"
                            onclick={() => insertExample(example.code)}
                            class="text-xs hover:underline ui-link"
                          >
                            Use this
                          </button>
                        </div>
                        <code
                          class="block text-xs break-all whitespace-pre-wrap ui-muted"
                        >
                          {example.code}
                        </code>
                        <p
                          class="mt-1 text-xs ui-muted"
                        >
                          {example.description}
                        </p>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="relative">
                <Code class="absolute left-3 top-3 ui-muted" size={18} />
                <textarea
                  id="rule_code"
                  bind:value={formRuleCode}
                  required
                  rows="4"
                  spellcheck="false"
                  placeholder="e.g., user.emailAddress.contains('admin')"
                  class="w-full rounded-lg border py-2 pl-10 pr-4 font-mono text-sm focus:outline-none focus:ring-2 ui-card ui-text ui-border"
                ></textarea>
              </div>
              <p class="mt-1 text-xs ui-muted">
                A code expression that evaluates the access control logic (e.g.,
                checking user attributes, roles, or resource properties)
              </p>
            </div>

            <!-- Description Field -->
            <div>
              <label
                for="description"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Description
              </label>
              <textarea
                id="description"
                bind:value={formDescription}
                rows="3"
                placeholder="Only allow access to users with admin email"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              ></textarea>
              <p class="mt-1 text-xs ui-muted">
                A human-readable description of what this rule does
              </p>
            </div>

            <!-- Policy Field -->
            <div>
              <label
                for="policy"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Policy <span class="ui-text-error">*</span>
              </label>
              <input
                id="policy"
                type="text"
                bind:value={formPolicy}
                required
                placeholder="e.g., account-access"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              />
              <p class="mt-1 text-xs ui-muted">
                Policy this Rule supports
              </p>
            </div>

            <!-- Is Active Checkbox -->
            <div
              class="rounded-lg border p-4 ui-card ui-border"
            >
              <label class="flex items-start">
                <input
                  type="checkbox"
                  bind:checked={formIsActive}
                  class="mt-0.5 h-4 w-4 rounded focus:ring-2 ui-link ui-panel ui-border"
                />
                <div class="ml-3">
                  <span
                    class="text-sm font-medium ui-muted"
                  >
                    Rule is Active
                  </span>
                  <p class="mt-1 text-xs ui-muted">
                    When active, this rule will be evaluated for access control
                    decisions. Inactive rules are ignored but remain in the
                    system.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onclick={handleCancel}
              disabled={isSubmitting}
              class="rounded-lg border px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="rounded-lg px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 preset-filled-primary-500"
            >
              {#if isSubmitting}
                <span class="flex items-center">
                  <svg
                    class="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                  Creating...
                </span>
              {:else}
                Create ABAC Rule
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
