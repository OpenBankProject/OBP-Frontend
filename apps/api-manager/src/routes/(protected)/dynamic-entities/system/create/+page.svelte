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
  import { page } from "$app/state";
  import type { PageData } from "./$types";
  import { dynamicEntityTemplates } from "$lib/data/dynamicEntityTemplates";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let { data }: { data: PageData } = $props();

  let userEntitlements = $derived(data.userEntitlements || []);

  // Default level based on which role the user has
  let hasSystemCreateRole = $derived(
    userEntitlements.some((ent: any) => ent.role_name === "CanCreateSystemLevelDynamicEntity")
  );
  let hasBankCreateRole = $derived(
    userEntitlements.some((ent: any) =>
      ent.role_name === "CanCreateBankLevelDynamicEntity" && ent.bank_id === currentBank.bankId
    )
  );

  let entityLevel = $state<"system" | "bank">("system");
  let bankId = $derived(currentBank.bankId);

  // Set initial level once entitlements are available
  let initialLevelSet = false;
  $effect(() => {
    if (!initialLevelSet && userEntitlements.length > 0) {
      if (hasSystemCreateRole) {
        entityLevel = "system";
      } else if (hasBankCreateRole) {
        entityLevel = "bank";
      }
      initialLevelSet = true;
    }
  });

  // Role required to create the dynamic entity definition
  let requiredRole = $derived(
    entityLevel === "system"
      ? "CanCreateSystemLevelDynamicEntity"
      : "CanCreateBankLevelDynamicEntity"
  );

  let hasRequiredRole = $derived(
    userEntitlements.some((ent: any) => {
      if (ent.role_name !== requiredRole) return false;
      if (entityLevel === "bank") {
        return ent.bank_id === bankId;
      }
      return true;
    })
  );

  // Prefill from a named template, e.g. /dynamic-entities/system/create?template=training-progress
  const templateKey = page.url.searchParams.get("template");
  const template = templateKey ? dynamicEntityTemplates[templateKey] : undefined;

  let entityName = $state(template?.entityName ?? "");
  let entityDescription = $state(template?.description ?? "");
  let schemaJson = $state(template?.schemaJson ?? `{
  "properties": {
    "name": {
      "type": "string",
      "description": "Name field",
      "example": "Example Name"
    },
    "age": {
      "type": "integer",
      "description": "Age in years",
      "example": 25,
      "minimum": 0,
      "maximum": 150
    },
    "active": {
      "type": "boolean",
      "description": "Is active",
      "example": true
    },
    "internal_note": {
      "type": "string",
      "description": "Write-restricted: settable only via PATCH by a holder of the field's write role",
      "example": "set by a privileged service",
      "write_role_required": true
    },
    "risk_score": {
      "type": "string",
      "description": "Read-restricted: omitted from GET unless the caller holds CanReadRisk",
      "example": "low",
      "read_role": "CanReadRisk"
    }
  },
  "required": ["name"]
}`);
  let hasPersonalEntity = $state(template?.hasPersonalEntity ?? false);
  let hasPublicAccess = $state(template?.hasPublicAccess ?? false);
  let hasCommunityAccess = $state(template?.hasCommunityAccess ?? false);
  let personalRequiresRole = $state(template?.personalRequiresRole ?? false);
  // Row level access: the per-row ACL replaces the entity's Get/Update/Delete roles on the
  // System routes. Mutually exclusive with public and community access (OBP-API rejects the combination).
  let useRowLevelAccess = $state(template?.useRowLevelAccess ?? false);
  // Who may hold the entity's roles on its data endpoints (OBP-API v6.0.0 auth_mode).
  const AUTH_MODES = [
    { value: "UserOnly", label: "Users only (default)", hint: "The calling User must hold the Entitlement." },
    { value: "ApplicationOnly", label: "Applications only", hint: "The calling Consumer must hold the Scope; no User is needed." },
    { value: "UserOrApplication", label: "Users or applications", hint: "Either the User's Entitlement or the Consumer's Scope is enough." },
    { value: "UserAndApplication", label: "Users and applications", hint: "Both the User's Entitlement and the Consumer's Scope are required." },
  ];
  let authMode = $state<string>(template?.authMode ?? "UserOnly");
  let isSubmitting = $state(false);
  let schemaError = $state("");

  function validateSchema(): boolean {
    try {
      const parsed = JSON.parse(schemaJson);
      if (!parsed.properties || typeof parsed.properties !== "object") {
        schemaError = "Schema must have a 'properties' object";
        return false;
      }
      schemaError = "";
      return true;
    } catch (e) {
      schemaError = e instanceof Error ? e.message : "Invalid JSON";
      return false;
    }
  }

  function validateEntityName(name: string): boolean {
    const validPattern = /^[a-z0-9_]+$/;
    return validPattern.test(name);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (entityLevel === "bank" && !bankId) {
      alert("Please select a current bank first to create a bank-level entity");
      return;
    }

    if (!entityName.trim()) {
      alert("Entity name is required");
      return;
    }

    if (!validateEntityName(entityName)) {
      alert("Entity name can only contain lowercase letters, numbers, and underscores. No spaces or hyphens allowed. e.g., school_friend");
      return;
    }

    if (!validateSchema()) {
      alert("Please fix the schema errors");
      return;
    }

    isSubmitting = true;

    try {
      const schema = JSON.parse(schemaJson);

      // Construct the system dynamic entity payload for v6.0.0
      const payload: Record<string, any> = {
        entity_name: entityName,
        schema: {
          description: entityDescription || `${entityName} entity`,
          required: schema.required || [],
          properties: schema.properties,
        },
        has_personal_entity: hasPersonalEntity,
        has_public_access: hasPublicAccess,
        has_community_access: hasCommunityAccess,
        personal_requires_role: personalRequiresRole,
        use_row_level_access: useRowLevelAccess,
        auth_mode: authMode,
      };

      const createUrl = entityLevel === "bank"
        ? `/proxy/obp/v6.0.0/management/banks/${bankId}/dynamic-entities`
        : `/proxy/obp/v6.0.0/management/system-dynamic-entities`;

      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create entity",
        );
        logErrorDetails(`Create ${entityLevel === "bank" ? "Bank" : "System"} Dynamic Entity`, errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert(`${entityLevel === "bank" ? "Bank" : "System"} dynamic entity created successfully`);
      goto("/dynamic-entities/system");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create entity";
      alert(`Error: ${errorMsg}`);
      console.error("Create error:", error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create System Dynamic Entity - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <a
      href="/dynamic-entities/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      <svg
        class="mr-2 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to System Dynamic Entities
    </a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Create Dynamic Entity
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Define a new dynamic entity schema
    </p>
    {#if template}
      <p
        class="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
        data-testid="template-applied"
      >
        Form prefilled from the <code>{templateKey}</code> template.
      </p>
    {:else if templateKey}
      <p
        class="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        data-testid="template-unknown"
      >
        Unknown template <code>{templateKey}</code> — starting from the default example.
      </p>
    {/if}
  </div>

  <!-- Form -->
  <div
    class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <form onsubmit={handleSubmit} class="space-y-6">
      <!-- Level -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Level
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          System entities are available across all banks. Bank entities are scoped to a specific bank.
        </p>
        <div class="mt-2 flex gap-4">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="entityLevel"
              value="system"
              bind:group={entityLevel}
              class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            System
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="entityLevel"
              value="bank"
              bind:group={entityLevel}
              disabled={!bankId}
              class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            Bank
            {#if bankId}
              <span class="text-xs text-gray-500 dark:text-gray-400">({currentBank.bank?.full_name || bankId})</span>
            {:else}
              <span class="text-xs text-gray-400">(no bank selected)</span>
            {/if}
          </label>
        </div>
      </div>

      <!-- Role Check -->
      {#if !hasRequiredRole}
        <MissingRoleAlert
          roles={[requiredRole]}
          bankId={entityLevel === "bank" ? bankId : undefined}
          message={`You need the role ${requiredRole} to create a ${entityLevel}-level dynamic entity`}
        />
      {/if}

      <!-- Entity Name -->
      <div>
        <label
          for="entityName"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Entity Name <span class="text-red-600">*</span>
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          The name of your entity. Only lowercase letters, numbers, and underscores allowed (e.g., piano, school_friend)
        </p>
        <input
          type="text"
          id="entityName"
          bind:value={entityName}
          required
          placeholder="e.g., piano"
          class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Description -->
      <div>
        <label
          for="description"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Description
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          A brief description of this entity
        </p>
        <input
          type="text"
          id="description"
          bind:value={entityDescription}
          placeholder="e.g., Musical instrument entity"
          class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Has Personal Entity -->
      <div>
        <div class="flex items-start">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="hasPersonalEntity"
              bind:checked={hasPersonalEntity}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </div>
          <div class="ml-3">
            <label
              for="hasPersonalEntity"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Has Personal Entity
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When enabled, each user can create their own personal instances of
              this entity type. Personal entity records are private to the user
              who created them, while the system entity definition remains
              shared. Leave unchecked if records should only exist at the system
              level. For shared data, leave this unchecked.
            </p>
          </div>
        </div>
      </div>

      <!-- Has Public Access -->
      <div>
        <div class="flex items-start">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="hasPublicAccess"
              bind:checked={hasPublicAccess}
              disabled={useRowLevelAccess}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </div>
          <div class="ml-3">
            <label
              for="hasPublicAccess"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Has Public Access
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When enabled, records of this entity type can be accessed publicly
              without authentication.
            </p>
          </div>
        </div>
      </div>

      <!-- Has Community Access -->
      <div>
        <div class="flex items-start">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="hasCommunityAccess"
              bind:checked={hasCommunityAccess}
              disabled={useRowLevelAccess}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </div>
          <div class="ml-3">
            <label
              for="hasCommunityAccess"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Has Community Access
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When enabled, records of this entity type can be accessed by any
              authenticated user (community member).
            </p>
          </div>
        </div>
      </div>

      <!-- Personal Requires Role -->
      <div>
        <div class="flex items-start">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="personalRequiresRole"
              bind:checked={personalRequiresRole}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </div>
          <div class="ml-3">
            <label
              for="personalRequiresRole"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Personal Requires Role
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Restricts who can create personal entity records to those who have
              the role.
            </p>
          </div>
        </div>
      </div>

      <!-- Use Row Level Access -->
      <div>
        <div class="flex items-start">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="useRowLevelAccess"
              name="use_row_level_access"
              bind:checked={useRowLevelAccess}
              disabled={hasPublicAccess || hasCommunityAccess}
              data-testid="dynamic-entity-use-row-level-access"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </div>
          <div class="ml-3">
            <label
              for="useRowLevelAccess"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Use Row Level Access
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Per-record sharing. The entity's Get, Update and Delete roles no longer decide access
              on the shared routes; an access list on each record does. The user who creates a record
              gets read, update, delete and grant on it, and shares it with
              <code>POST /obp/dynamic-entity/ENTITY_NAME/RECORD_ID/access</code>
              (<code>can_read</code>, <code>can_update</code>, <code>can_delete</code>, <code>can_grant</code> per user).
              Records you cannot read are hidden from lists and return 404. Field-level read and write
              roles still apply on top. Mutually exclusive with public and community access.
            </p>
          </div>
        </div>
      </div>

      <!-- Auth mode -->
      <div>
        <label for="authMode" class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Who may hold this entity's roles
        </label>
        <select
          id="authMode"
          name="auth_mode"
          bind:value={authMode}
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          data-testid="dynamic-entity-auth-mode"
        >
          {#each AUTH_MODES as m (m.value)}
            <option value={m.value} disabled={m.value === "ApplicationOnly" && hasPersonalEntity}>{m.label}</option>
          {/each}
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {AUTH_MODES.find((m) => m.value === authMode)?.hint}
          The roles are CanCreate, CanGet, CanUpdate and CanDelete for this entity; grant them to Users as Entitlements or to Consumers as Scopes.
          Personal (<code>/my/</code>) endpoints always require a User{hasPersonalEntity ? ", so a personal entity cannot be applications-only" : ""}.
        </p>
      </div>

      <!-- Schema JSON -->
      <div>
        <label
          for="schema"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Schema (JSON) <span class="text-red-600">*</span>
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Define the properties of your entity in JSON format
        </p>
        <textarea
          id="schema"
          bind:value={schemaJson}
          oninput={() => validateSchema()}
          rows="15"
          class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        ></textarea>
        {#if schemaError}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">
            {schemaError}
          </p>
        {/if}
      </div>

      <!-- Help Text -->
      <div
        class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
      >
        <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Schema Format Guide
        </h3>
        <ul class="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
          <li>
            <strong>properties:</strong> Define fields with type, description, and
            validation rules
          </li>
          <li>
            <strong>type:</strong> Can be "string", "number", "integer", "boolean",
            "json", "DATE_WITH_DAY" (also "reference:..." types)
          </li>
          <li>
            <strong>required:</strong> Array of required field names (must be present, can be empty [])
          </li>
          <li>
            <strong>minLength/maxLength:</strong> For string validation (optional)
          </li>
          <li>
            <strong>example:</strong> Example value for the field (required)
          </li>
          <li>
            <strong>description:</strong> Human-readable description of the field (optional)
          </li>
        </ul>

        <h4 class="mt-4 text-sm font-semibold text-blue-900 dark:text-blue-100">
          Field-level access control
        </h4>
        <p class="mt-1 text-xs text-blue-800 dark:text-blue-200">
          Set these keys on a property, in snake_case — OBP-API ignores any other spelling.
        </p>
        <ul class="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
          <li>
            <strong><code>write_role_required</code>: true</strong> — the field becomes
            <em>write-restricted</em>: POST ignores it and PUT preserves its existing value; it is
            written only by PATCH from a holder of the auto-generated role
            <code>CanWriteDynamicEntityField_System&lt;Entity&gt;__&lt;field&gt;</code>.
          </li>
          <li>
            <strong><code>write_role</code>: "CanWriteX"</strong> — the same, against an explicit role
            you name, so several fields or entities can share one role.
          </li>
          <li>
            <strong><code>read_role_required</code>: true</strong> — the field becomes
            <em>read-restricted</em>: it is omitted from GET responses unless the caller holds
            <code>CanGetDynamicEntityField_System&lt;Entity&gt;__&lt;field&gt;</code>. Public and
            anonymous reads never see it.
          </li>
          <li>
            <strong><code>read_role</code>: "CanReadX"</strong> — the same, against an explicit role.
          </li>
        </ul>

        <h4 class="mt-4 text-sm font-semibold text-blue-900 dark:text-blue-100">
          Who may create, update and delete records
        </h4>
        <p class="mt-1 text-xs text-blue-800 dark:text-blue-200">
          Four layers, set by the options above rather than in the schema JSON. They stack.
        </p>
        <ul class="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
          <li>
            <strong>1. Entity roles.</strong> Every entity generates
            <code>CanCreateDynamicEntity_System&lt;Entity&gt;</code>,
            <code>CanGetDynamicEntity_System&lt;Entity&gt;</code>,
            <code>CanUpdateDynamicEntity_System&lt;Entity&gt;</code> and
            <code>CanDeleteDynamicEntity_System&lt;Entity&gt;</code>
            (without <code>System</code> for a bank-level entity, held at that bank). They gate the
            shared routes <code>/obp/dynamic-entity/ENTITY_NAME</code>.
          </li>
          <li>
            <strong>2. Route scope.</strong> <em>Has Personal Entity</em> adds
            <code>/obp/dynamic-entity/my/ENTITY_NAME</code>, where each user reads and writes only
            their own records — no role unless <em>Personal Requires Role</em> is set.
            <em>Has Community Access</em> (<code>/community/</code>) and <em>Has Public Access</em>
            (<code>/public/</code>) are read-only routes: neither ever grants a write.
          </li>
          <li>
            <strong>3. Row level access.</strong> <em>Use Row Level Access</em> replaces the entity
            Get, Update and Delete roles with a per-record access list carrying
            <code>can_read</code>, <code>can_update</code>, <code>can_delete</code> and
            <code>can_grant</code>. The creator holds all four on their record and shares it via
            <code>GET/POST /obp/dynamic-entity/ENTITY_NAME/RECORD_ID/access</code> and
            <code>DELETE .../access/USER_ID</code>; revoking cascades to grants that user passed on.
            <code>CanGrantDynamicEntityRowAccess_System&lt;Entity&gt;</code> administers any record.
            Creating a record still takes the entity's Create role.
          </li>
          <li>
            <strong>4. Field roles.</strong> <code>write_role</code> and <code>read_role</code> above,
            applied on top of whichever of the layers let the caller reach the record at all.
          </li>
          <li>
            <strong>Who may hold the roles</strong> is the <em>auth mode</em> above: a User's
            Entitlement, a Consumer's Scope, either, or both. The <code>/my/</code> and row-level
            routes always need a User.
          </li>
        </ul>

        {#if data.externalLinks?.API_EXPLORER_URL}
          <div class="mt-3 border-t border-blue-300 pt-3 dark:border-blue-700">
            <a
              href="{data.externalLinks
                .API_EXPLORER_URL}/resource-docs/OBPv6.0.0?operationid=OBPv4.0.0-createSystemDynamicEntity"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
            >
              View API Documentation on API Explorer
              <svg
                class="ml-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
        <a
          href="/dynamic-entities/system"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit-create-entity"
          class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {#if isSubmitting}
            Creating...
          {:else}
            Create Entity
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
