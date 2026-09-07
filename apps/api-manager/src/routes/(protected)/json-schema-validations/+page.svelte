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
  import { page } from "$app/state";
  import { invalidateAll } from "$app/navigation";
  import { CircleHelp, Plus, Trash2, Pencil } from "@lucide/svelte";
  import { deleteJsonSchemaValidation } from "$lib/services/jsonSchemaValidations";

  let { data } = $props();

  let message = $state<string | null>(page.url.searchParams.get("saved") ? `Saved the validation for ${page.url.searchParams.get("saved")}.` : null);
  let actionError = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  async function remove(operationId: string) {
    if (!confirm(`Delete the JSON Schema Validation for ${operationId}? Requests to that endpoint will no longer be checked.`)) return;
    deleting = operationId;
    actionError = null;
    try {
      await deleteJsonSchemaValidation(operationId);
      message = `Deleted the validation for ${operationId}.`;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = null;
    }
  }

  function requiredFields(schema: Record<string, unknown>): string {
    const req = schema?.required;
    return Array.isArray(req) ? req.join(", ") : "";
  }
  function propertyCount(schema: Record<string, unknown>): number {
    const props = schema?.properties;
    return props && typeof props === "object" ? Object.keys(props).length : 0;
  }
</script>

<svelte:head>
  <title>JSON Schema Validations - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">JSON Schema Validations</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">Request-body rules OBP enforces on individual endpoints, keyed by operation id.</p>
    </div>
    <div class="flex items-center gap-2">
      <a href="/json-schema-validations/help" data-testid="json-schema-validations-help-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        <CircleHelp size={16} /> Help
      </a>
      <a href="/json-schema-validations/create" data-testid="create-link" class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
        <Plus size={16} /> Create Validation
      </a>
    </div>
  </div>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="message">{message}</div>
  {/if}

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.rows.length === 0}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
        No JSON Schema Validations yet.
        <a href="/json-schema-validations/create" class="text-blue-600 hover:underline dark:text-blue-400">Create one</a> to constrain an endpoint's request body.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="json-schema-validations-table">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Operation id</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Endpoint</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Schema</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Required</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each data.rows as row (row.operation_id)}
              <tr data-testid="row-{row.operation_id}">
                <td class="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">
                  <a href="/json-schema-validations/{encodeURIComponent(row.operation_id)}" class="text-blue-600 hover:underline dark:text-blue-400">{row.operation_id}</a>
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {#if row.endpoint}
                    <span class="font-mono text-xs">{row.endpoint.request_verb} {row.endpoint.request_url}</span>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{row.endpoint.summary}</div>
                  {:else}
                    <span class="text-xs text-gray-400">not in the resource docs</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {row.json_schema?.title ? String(row.json_schema.title) : ""}
                  <div class="text-xs text-gray-500 dark:text-gray-400">{propertyCount(row.json_schema)} propert{propertyCount(row.json_schema) === 1 ? "y" : "ies"}</div>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{requiredFields(row.json_schema)}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <a href="/json-schema-validations/{encodeURIComponent(row.operation_id)}" class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="edit-{row.operation_id}"><Pencil size={12} /> Edit</a>
                    <button type="button" onclick={() => remove(row.operation_id)} disabled={deleting === row.operation_id} class="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20" data-testid="delete-{row.operation_id}">
                      <Trash2 size={12} /> {deleting === row.operation_id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">{data.rows.length} validation{data.rows.length === 1 ? "" : "s"}</div>
    {/if}
  </div>
</div>
