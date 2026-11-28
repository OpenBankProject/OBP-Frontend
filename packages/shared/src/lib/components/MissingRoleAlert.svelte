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
  import { ShieldCheck } from "@lucide/svelte";
  import MessageBox from "$shared/components/MessageBox.svelte";
  import RichMessage from "$shared/components/RichMessage.svelte";
  import { m, getLocale, textDirection } from "$shared/i18n";
  import { getRoleRequests } from "$shared/roles/context";
  import { onMount } from "svelte";

  // The app's wiring (set in its layout): where requests go, the chosen bank, and which Roles need a bank.
  const requests = getRoleRequests();

  interface Props {
    roles: string[];
    errorCode?: string;
    message?: string;
    bankId?: string;
    /** When true, JIT will auto-grant this role on first use — show as informational, not blocking */
    jitCovered?: boolean;
  }

  let { roles, errorCode, message, bankId, jitCovered = false }: Props = $props();

  let isExpanded = $state(false);
  // The arrow of a closed alert points the way the text reads.
  const closedArrow = textDirection(getLocale()) === "rtl" ? "◀" : "▶";
  let isSubmitting = $state(false);
  let submitSuccess = $state(false);
  let submitError = $state<string | null>(null);
  let rolesMetadata = $state<Map<string, boolean>>(new Map());
  let loadingMetadata = $state(false);
  let selectedBankId = $derived(requests.currentBankId());
  // "bank" = bank-scoped (send bank_id), "system" = system-wide (send empty string)
  let scopeChoice = $state<"bank" | "system">("bank");

  // Fetch role metadata on mount
  onMount(async () => {
    loadingMetadata = true;
    try {
      // Build a map of role name -> requires_bank_id. Without the app's lookup, a Role given a bank is a bank Role.
      const metadataMap = new Map<string, boolean>();
      for (const roleName of roles) {
        metadataMap.set(roleName, requests.roleRequiresBank ? await requests.roleRequiresBank(roleName) : Boolean(bankId));
      }
      rolesMetadata = metadataMap;

      // Default scope based on whether role requires bank_id
      const anyRequiresBank = Array.from(metadataMap.values()).some((v) => v);
      if (!anyRequiresBank) {
        scopeChoice = "system";
      } else {
        scopeChoice = "bank";
      }
    } catch (error) {
      console.error("Failed to fetch role metadata:", error);
    } finally {
      loadingMetadata = false;
    }
  });

  // Check if any role requires bank_id
  let requiresBankId = $derived(
    Array.from(rolesMetadata.values()).some((requires) => requires),
  );

  // The bank_id to request the role at: the bank the caller named (as shown above), else empty for a system-wide role,
  // else the bank chosen in My Account.
  let effectiveBankId = $derived(
    bankId ? bankId : scopeChoice === "system" ? "" : selectedBankId
  );

  async function handleRequestClick() {
    if (isSubmitting) return;

    // Validate bank selection if bank-scoped
    if (!bankId && scopeChoice === "bank" && !selectedBankId) {
      submitError = m.role_alert_choose_bank_first();
      return;
    }

    isSubmitting = true;
    submitError = null;

    try {
      // Submit entitlement request for each missing role
      for (const role of roles) {
        const requestBody: any = {
          role_name: role,
          // Always send bank_id - use empty string for system-wide roles
          bank_id: effectiveBankId || "",
        };

        const response = await fetch(requests.requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message,
          );
        }
      }

      submitSuccess = true;
    } catch (error) {
      submitError =
        error instanceof Error ? error.message : m.role_alert_request_failed();
      isSubmitting = false;
    }
  }
</script>

<div class="alert" class:alert-missing-role={!jitCovered} class:alert-jit-covered={jitCovered} class:expanded={isExpanded}>
  <button
    type="button"
    class="alert-header"
    onclick={() => isExpanded = !isExpanded}
  >
    <span class="alert-icon">{jitCovered ? "⚡" : "🔒"}</span>
    <span class="alert-title">
      {#if jitCovered}
        <strong>{roles.length > 1 ? m.role_alert_jit_many() : m.role_alert_jit_one()}</strong>
      {:else}
        <strong>{roles.length > 1 ? m.role_alert_missing_many() : m.role_alert_missing_one()}</strong>
      {/if}
      <span class="role-preview">{roles.join(", ")}</span>
    </span>
    {#if errorCode}
      <span class="error-code">OBP-{errorCode}</span>
    {/if}
    <span class="expand-icon">{isExpanded ? "▼" : closedArrow}</span>
  </button>

  {#if isExpanded}
    <div class="alert-content">
      <div class="entitlement-list">
        {#each roles as role}
          <div class="entitlement-name">{role}</div>
        {/each}
      </div>

      <!-- Role scope display (auto-determined from role metadata) -->
      {#if bankId}
        <div class="scope-display scope-bank">
          <RichMessage parts={m.role_alert_bank_role.parts({ bankId })} />
        </div>
      {:else if scopeChoice === "bank"}
        <div class="scope-display scope-bank">
          {#if selectedBankId}
            <RichMessage parts={m.role_alert_bank_role.parts({ bankId: selectedBankId })} />
          {:else}
            <RichMessage parts={m.role_alert_bank_role_choose.parts()} links={{ choose: requests.selectBankUrl }} />
          {/if}
        </div>
      {:else}
        <div class="scope-display scope-system">
          <RichMessage parts={m.role_alert_system_role.parts()} />
        </div>
      {/if}

      {#if message}
        <MessageBox {message} type="error" />
      {/if}

      {#if submitError}
        <MessageBox message={submitError} type="error" />
      {/if}

      {#if jitCovered}
        <div class="jit-info">
          <RichMessage parts={m.role_alert_jit_info.parts()} />
        </div>
      {:else if submitSuccess}
        <div class="submit-success">
          <RichMessage parts={m.role_alert_requested.parts()} links={{ requests: requests.requestsPageUrl }} />
        </div>
      {:else}
        <div class="alert-actions">
          <button
            class="btn-request"
            onclick={handleRequestClick}
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="spinner">⏳</span>
              {m.role_alert_submitting()}
            {:else}
              <ShieldCheck size={18} />
              {m.role_alert_request()}
            {/if}
          </button>
        </div>
      {/if}

      {#if !jitCovered}
        <div class="tip-box">
          <RichMessage parts={m.role_alert_tip.parts()} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .alert {
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .alert-missing-role {
    background: var(--ui-tone-warning-bg);
    border: 2px solid var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
    padding: 0.75rem 1rem;
  }

  .alert-missing-role.expanded {
    padding: 1rem 1.25rem;
  }

  .alert-jit-covered {
    background: var(--ui-tone-success-bg);
    border: 2px solid var(--ui-tone-success-border);
    color: var(--ui-tone-success-text);
    padding: 0.75rem 1rem;
  }

  .alert-jit-covered.expanded {
    padding: 1rem 1.25rem;
  }

  .alert-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: start;
    color: inherit;
  }

  .alert-header:hover {
    opacity: 0.9;
  }

  .expanded .alert-header {
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .alert-title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .role-preview {
    font-weight: normal;
    font-size: 0.8125rem;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expand-icon {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-inline-start: auto;
    flex-shrink: 0;
  }

  .alert-content {
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .alert-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-code {
    font-size: 0.75rem;
    font-family: monospace;
    background: var(--ui-panel);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    margin-inline-start: auto;
  }

  .entitlement-list {
    margin: 1rem 0;
  }

  .entitlement-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-warning);
    margin: 0.5rem 0;
  }

  .alert-jit-covered .entitlement-name {
    color: var(--ui-success);
  }

  .scope-display :global(code) {
    background: var(--ui-panel);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .alert-actions {
    margin-top: 1rem;
    border-top: 1px solid var(--ui-border);
    padding-top: 1rem;
  }

  .btn-request {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-request:hover {
    background: var(--ui-tone-success-bg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
    color: var(--ui-tone-success-text);
  }

  .btn-request:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-request:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  .spinner {
    display: inline-block;
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

  .jit-info {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--ui-tone-success-bg);
    border: 1px solid var(--ui-tone-success-border);
    border-radius: 4px;
    color: var(--ui-tone-success-text);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .submit-success {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--ui-tone-success-bg);
    border: 1px solid var(--ui-tone-success-border);
    border-radius: 4px;
    color: var(--ui-tone-success-text);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .submit-success :global(a) {
    color: var(--ui-link);
    text-decoration: underline;
    font-weight: 600;
  }

  .submit-success :global(a:hover) {
    color: var(--ui-link-hover);
  }

  .tip-box {
    margin: 1rem 0;
    padding: 0.75rem;
    background: var(--ui-tone-info-bg);
    border-inline-start: 3px solid var(--ui-tone-info-border);
    border-radius: 4px;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .scope-display {
    margin: 0.75rem 0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .scope-display.scope-bank {
    background: var(--ui-tone-warning-bg);
    border: 1px solid var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
  }

  .scope-display.scope-system {
    background: var(--ui-tone-info-bg);
    border: 1px solid var(--ui-tone-info-border);
    color: var(--ui-tone-info-text);
  }

  .scope-display :global(a) {
    color: var(--ui-link);
    text-decoration: underline;
    font-weight: 600;
  }

  .scope-display :global(a:hover) {
    color: var(--ui-link-hover);
  }

</style>
