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

  let { data }: { data: PageData } = $props();

  let swaggerJson = $state(`{
  "swagger": "2.0",
  "info": {
    "title": "My Dynamic Endpoint",
    "description": "A dynamic endpoint created via API Manager",
    "version": "1.0.0"
  },
  "host": "obp_mock",
  "basePath": "/",
  "schemes": ["https"],
  "paths": {
    "/my-endpoint": {
      "get": {
        "summary": "Get my data",
        "description": "Retrieve data from my dynamic endpoint",
        "operationId": "getMyData",
        "produces": ["application/json"],
        "responses": {
          "200": {
            "description": "Successful response",
            "schema": {
              "type": "object",
              "properties": {
                "message": {
                  "type": "string",
                  "example": "Hello from dynamic endpoint"
                }
              }
            }
          }
        }
      }
    }
  }
}`);
  let isSubmitting = $state(false);
  let swaggerError = $state("");

  function validateSwagger(): boolean {
    try {
      const parsed = JSON.parse(swaggerJson);

      if (!parsed.swagger && !parsed.openapi) {
        swaggerError = "Missing 'swagger' or 'openapi' version field";
        return false;
      }

      if (!parsed.paths || typeof parsed.paths !== "object") {
        swaggerError = "Swagger must have a 'paths' object";
        return false;
      }

      if (Object.keys(parsed.paths).length === 0) {
        swaggerError = "At least one path must be defined";
        return false;
      }

      swaggerError = "";
      return true;
    } catch (e) {
      swaggerError = e instanceof Error ? e.message : "Invalid JSON";
      return false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!validateSwagger()) {
      alert("Please fix the swagger errors");
      return;
    }

    isSubmitting = true;

    try {
      const swagger = JSON.parse(swaggerJson);

      const response = await fetch(`/proxy/obp/v6.0.0/management/dynamic-endpoints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(swagger),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create endpoint",
        );
        logErrorDetails("Create System Dynamic Endpoint", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert("System dynamic endpoint created successfully");
      goto("/dynamic-endpoints/system");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create endpoint";
      alert(`Error: ${errorMsg}`);
      console.error("Create error:", error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create System Dynamic Endpoint - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <a
      href="/dynamic-endpoints/system"
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
      Back to System Dynamic Endpoints
    </a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Create System Dynamic Endpoint
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Define a new system dynamic endpoint using Swagger/OpenAPI specification
    </p>
  </div>

  <!-- Form -->
  <div
    class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <form onsubmit={handleSubmit} class="space-y-6">
      <!-- Swagger JSON -->
      <div>
        <label
          for="swagger"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Swagger/OpenAPI Specification (JSON) <span class="text-red-600">*</span>
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Define your endpoint using Swagger 2.0 or OpenAPI 3.0 specification
        </p>
        <textarea
          id="swagger"
          bind:value={swaggerJson}
          oninput={() => validateSwagger()}
          rows="25"
          class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        ></textarea>
        {#if swaggerError}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">
            {swaggerError}
          </p>
        {/if}
      </div>

      <!-- Help Text -->
      <div
        class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
      >
        <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Swagger Specification Guide
        </h3>
        <ul class="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
          <li>
            <strong>swagger/openapi:</strong> Version (e.g., "2.0" or "3.0.0")
          </li>
          <li>
            <strong>info:</strong> Title, description, and version of your API
          </li>
          <li>
            <strong>host:</strong> Target host (e.g., "obp_mock", "dynamic_entity", or a URL)
          </li>
          <li>
            <strong>paths:</strong> Define your endpoint paths and HTTP methods
          </li>
          <li>
            <strong>responses:</strong> Define response schemas and status codes
          </li>
        </ul>
        <div class="mt-3 border-t border-blue-300 pt-3 dark:border-blue-700">
          <p class="text-xs text-blue-800 dark:text-blue-200">
            <strong>Host options:</strong>
          </p>
          <ul class="mt-1 space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <li><code class="bg-blue-100 px-1 dark:bg-blue-900">obp_mock</code> - Returns mock response based on swagger example</li>
            <li><code class="bg-blue-100 px-1 dark:bg-blue-900">dynamic_entity</code> - Routes to a dynamic entity</li>
            <li><code class="bg-blue-100 px-1 dark:bg-blue-900">https://example.com</code> - Proxies to external URL</li>
          </ul>
        </div>
        {#if data.externalLinks?.API_EXPLORER_URL}
          <div class="mt-3 border-t border-blue-300 pt-3 dark:border-blue-700">
            <a
              href="{data.externalLinks.API_EXPLORER_URL}/resource-docs/OBPv6.0.0?operationid=OBPv4.0.0-createDynamicEndpoint"
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
          href="/dynamic-endpoints/system"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {#if isSubmitting}
            Creating...
          {:else}
            Create Endpoint
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
