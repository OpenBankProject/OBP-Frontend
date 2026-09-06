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
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import type { RoleRequirement } from "$lib/utils/roleChecker";
  import { checkRoles } from "$lib/utils/roleChecker";
  import type { Snippet } from "svelte";

  interface Props {
    userEntitlements: any[];
    required: RoleRequirement[];
    optional?: RoleRequirement[];
    requirementType?: "OR" | "AND";
    currentBankId?: string;
    jitEnabled?: boolean;
    children?: Snippet;
  }

  let { userEntitlements, required, optional, requirementType = "OR", currentBankId, jitEnabled = false, children }: Props =
    $props();

  // Check required roles using the configured logic (AND or OR)
  let requiredCheck = $derived.by(() => {
    return checkRoles(userEntitlements || [], required || [], currentBankId, requirementType, jitEnabled);
  });

  let showContent = $derived(requiredCheck.hasAllRoles);

  // For OR pages with mixed scopes: determine which scope the user operates at
  let isOrWithMixedScopes = $derived.by(() => {
    if (requirementType !== "OR" || required.length < 2) return false;
    const hasBankScoped = required.some((r) => r.bankScoped);
    const hasSystemScoped = required.some((r) => !r.bankScoped);
    return hasBankScoped && hasSystemScoped;
  });

  // Which scope(s) the user has roles for (only relevant for OR + mixed scopes)
  let userHasBankRoles = $derived(
    isOrWithMixedScopes && requiredCheck.hasRoles.some((r) => r.bankScoped),
  );
  let userHasSystemRoles = $derived(
    isOrWithMixedScopes && requiredCheck.hasRoles.some((r) => !r.bankScoped),
  );

  // Scope label for the info message
  let scopeMessage = $derived.by(() => {
    if (!isOrWithMixedScopes || !showContent) return null;
    if (userHasSystemRoles && userHasBankRoles) return "You have both system-level and bank-level access for this page.";
    if (userHasSystemRoles) return "You have system-level access for this page. Bank-level features are not available.";
    if (userHasBankRoles) return "You have bank-level access for this page. System-level features are not available.";
    return null;
  });

  // Check optional roles (informational — content still renders)
  let optionalCheck = $derived.by(() => {
    if (!optional || optional.length === 0) return null;
    return checkRoles(userEntitlements || [], optional, currentBankId, "OR", jitEnabled);
  });

  let missingOptionalRoles = $derived(
    optionalCheck && !optionalCheck.hasAllRoles
      ? optionalCheck.missingRoles
      : [],
  );
</script>

{#if requiredCheck.missingRoles.length > 0}
  <div class="role-alerts">
    {#if requirementType === "OR" && requiredCheck.missingRoles.length > 1}
      <div class="or-header">
        You need <strong>one</strong> of the following roles to access this page:
      </div>
    {/if}
    {#each requiredCheck.missingRoles as missingRole, i}
      {#if requirementType === "OR" && i > 0}
        <div class="or-divider"><span>OR</span></div>
      {/if}
      <MissingRoleAlert
        roles={[missingRole.role]}
        bankId={missingRole.bankId || undefined}
        message={requirementType === "AND"
          ? `You need the following role to access this page: ${missingRole.role}`
          : undefined}
      />
    {/each}
  </div>
{/if}

{#if showContent && children}
  {#if requiredCheck.jitRoles.length > 0}
    <div class="jit-note" data-testid="jit-entitlements-note">
      <span class="note-icon">&#x26A1;</span>
      <span>
        Just In Time Entitlements active: {requiredCheck.jitRoles.map((r) => r.role).join(", ")} will be auto-granted on first use.
      </span>
    </div>
  {/if}
  {#if scopeMessage}
    <div class="scope-note">
      <span class="note-icon">&#x2139;&#xFE0F;</span>
      <span>{scopeMessage}</span>
    </div>
  {/if}
  {#if missingOptionalRoles.length > 0}
    <div class="optional-role-note">
      <span class="note-icon">&#x2139;&#xFE0F;</span>
      <span>
        Some actions on this page require additional roles:
        {missingOptionalRoles.map((r) => r.role).join(", ")}
      </span>
    </div>
  {/if}
  {@render children()}
{/if}

<style>
  .role-alerts {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .or-header {
    font-size: 0.875rem;
    color: #92400e;
    padding: 0.5rem 1rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .or-header {
    background: rgba(217, 119, 6, 0.1);
    border-color: rgba(217, 119, 6, 0.3);
    color: #fbbf24;
  }

  .or-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: -0.25rem 0;
  }

  .or-divider::before,
  .or-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #d1d5db;
  }

  :global([data-mode="dark"]) .or-divider::before,
  :global([data-mode="dark"]) .or-divider::after {
    background: rgba(255, 255, 255, 0.15);
  }

  .or-divider span {
    font-size: 0.75rem;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .or-divider span {
    color: rgba(255, 255, 255, 0.4);
  }

  .scope-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 0.5rem;
    color: #92400e;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .scope-note {
    background: rgba(217, 119, 6, 0.1);
    border-color: rgba(217, 119, 6, 0.3);
    color: #fbbf24;
  }

  .jit-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 0.5rem;
    color: #166534;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .jit-note {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }

  .optional-role-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    color: #1e40af;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .optional-role-note {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .note-icon {
    flex-shrink: 0;
    font-size: 1rem;
  }
</style>
