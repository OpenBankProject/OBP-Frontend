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
  import {
    Code,
    AlertCircle,
    Info,
    ArrowLeft,
    Copy,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
  } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  // Reference to the textarea for insertion
  let ruleCodeTextarea: HTMLTextAreaElement;

  // Form states matching the actual API structure - pre-populated from loaded data
  let formRuleName = $state(data.rule?.rule_name || "");
  let formRuleCode = $state(data.rule?.rule_code || "");
  let formDescription = $state(data.rule?.description || "");
  let formPolicy = $state(data.rule?.policy || "");
  let formIsActive = $state(data.rule?.is_active ?? true);
  let formError = $state("");
  let isSubmitting = $state(false);

  // Validation states
  let validationStatus = $state<"idle" | "validating" | "valid" | "invalid">(
    "idle",
  );
  let validationError = $state<string | null>(null);
  let validationDetails = $state<any>(null);
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;
  let copiedValidationError = $state(false);
  let copiedSchemaError = $state(false);

  // Available objects and their fields for ABAC rules - fetched from OBP
  let availableObjects = $state<any[]>([]);
  let schemaExamples = $state<
    Array<{
      category?: string;
      title: string;
      code: string;
      description?: string;
    }>
  >([]);
  let schemaOperators = $state<string[]>([]);
  let schemaNotes = $state<string[]>([]);
  let schemaLoading = $state(true);
  let schemaError = $state<string | null>(null);

  // Fetch schema from OBP on mount
  async function fetchSchema() {
    schemaLoading = true;
    schemaError = null;
    try {
      const response = await fetch("/proxy/obp/v6.0.0/management/abac-rules-schema");
      const schema = await response.json();

      console.log("!!! SCHEMA FETCH RESPONSE !!!");
      console.log("Response status:", response.status);
      console.log("Response OK:", response.ok);
      console.log("Full schema response:", schema);

      if (!response.ok) {
        // DON'T FILTER - Show EVERYTHING from the error
        console.error("!!! SCHEMA FETCH FAILED !!!");
        console.error("Full error object:", schema);
        console.error("Error message:", schema.errorMessage);
        console.error("Error stack:", schema.errorStack);
        console.error("Raw error:", schema.rawError);
        console.error("Stringified:", schema.stringified);
        console.error("Endpoint:", schema.endpoint);

        // Create detailed error message with ALL information
        const errorParts = [
          `Status: ${response.status}`,
          `Error: ${schema.error || schema.errorMessage || "Unknown"}`,
          `API Manager Proxy: /proxy/obp/v6.0.0/management/abac-rules-schema`,
          `OBP Endpoint: ${schema.endpoint || "/obp/v6.0.0/management/abac-rules-schema"}`,
          `\n\nFull Details:\n${JSON.stringify(schema, null, 2)}`,
        ];

        throw new Error(errorParts.join("\n"));
      }

      // Transform OBP schema to our format
      // OBP returns: {parameters, object_types, examples, available_operators, notes}
      console.log("!!! SCHEMA TRANSFORMATION !!!");
      console.log("Schema has object_types?", !!schema.object_types);
      console.log("Is object_types array?", Array.isArray(schema.object_types));
      console.log("Number of object_types:", schema.object_types?.length);
      console.log("Schema has parameters?", !!schema.parameters);
      console.log("Number of parameters:", schema.parameters?.length);

      if (schema.object_types && Array.isArray(schema.object_types)) {
        console.log(
          "First object_type sample:",
          JSON.stringify(schema.object_types[0], null, 2),
        );

        // Create a map of object_types for lookup
        const objectTypeMap = new Map();
        schema.object_types.forEach((objType: any) => {
          objectTypeMap.set(objType.name, objType);
        });

        // Helper function to extract base type from Option[] or List[] wrappers
        const extractBaseType = (typeString: string): string => {
          // Handle Option[Type] -> Type
          const optionMatch = typeString.match(/^Option\[(.+)\]$/);
          if (optionMatch) {
            return optionMatch[1];
          }
          // Handle List[Type] -> Type
          const listMatch = typeString.match(/^List\[(.+)\]$/);
          if (listMatch) {
            return listMatch[1];
          }
          // Return as-is if no wrapper
          return typeString;
        };

        // Transform parameters into objects
        const parameterObjects: any[] = [];
        if (schema.parameters && Array.isArray(schema.parameters)) {
          console.log("!!! PROCESSING PARAMETERS !!!");
          console.log("Parameters count:", schema.parameters.length);
          console.log(
            "First parameter sample:",
            JSON.stringify(schema.parameters[0], null, 2),
          );

          schema.parameters.forEach((param: any) => {
            console.log(`Processing parameter: ${param.name}`);
            console.log(`  - Type: ${param.type}`);
            console.log(`  - Required: ${param.required}`);
            console.log(`  - Description: ${param.description}`);

            // Extract base type from Option[] or List[] wrappers
            const baseType = extractBaseType(param.type);
            console.log(`  - Base type: ${baseType}`);

            // Get the referenced object type
            const referencedType = objectTypeMap.get(baseType);

            if (referencedType) {
              const fields = (referencedType.properties || []).map(
                (prop: any) => ({
                  name: prop.name,
                  type: prop.type,
                  description: prop.description,
                }),
              );

              // Determine type label
              let typeLabel = param.type;
              if (param.type.startsWith("Option[")) {
                typeLabel += " (Optional)";
              } else if (param.type.startsWith("List[")) {
                typeLabel += " (List)";
              }

              parameterObjects.push({
                name: param.name,
                description: `${param.description} - Type: ${typeLabel}`,
                fields: fields,
                isParameter: true,
                parameterType: param.type,
                baseType: baseType,
                required: param.required,
                category: param.category,
              });
              console.log(
                `  - Created parameter object with ${fields.length} fields`,
              );
            } else {
              console.warn(
                `  - Referenced type '${baseType}' not found in object_types for parameter '${param.name}' (original type: ${param.type})`,
              );
            }
          });
        }

        // Transform object_types
        const objectTypeObjects = schema.object_types.map((objType: any) => {
          console.log(`Processing object type: ${objType.name}`);
          console.log(`  - Has properties? ${!!objType.properties}`);
          console.log(
            `  - Properties count: ${objType.properties?.length || 0}`,
          );

          const fields = (objType.properties || []).map((prop: any) => ({
            name: prop.name,
            type: prop.type,
            description: prop.description,
          }));

          console.log(`  - Transformed fields count: ${fields.length}`);

          return {
            name: objType.name,
            description: objType.description,
            fields: fields,
            isParameter: false,
          };
        });

        // Combine parameters and object types, with parameters first
        availableObjects = [...parameterObjects, ...objectTypeObjects];

        console.log("!!! TRANSFORMATION COMPLETE !!!");
        console.log("Parameter objects count:", parameterObjects.length);
        console.log("Object type objects count:", objectTypeObjects.length);
        console.log("Total available objects count:", availableObjects.length);
        console.log(
          "Available object names:",
          availableObjects.map((o) => o.name),
        );
        console.log(
          "Full transformed objects:",
          JSON.stringify(availableObjects, null, 2),
        );

        // Log additional schema information
        if (schema.parameters) {
          console.log("!!! PARAMETERS (raw) !!!");
          console.log("Parameters:", schema.parameters);
        }
        if (schema.examples) {
          console.log("!!! EXAMPLES !!!");
          console.log("Examples:", schema.examples);
        }
        if (schema.available_operators) {
          console.log("!!! AVAILABLE OPERATORS !!!");
          console.log("Operators:", schema.available_operators);
        }
        if (schema.notes) {
          console.log("!!! NOTES !!!");
          console.log("Notes:", schema.notes);
        }

        // Store examples, operators, and notes for UI display
        schemaExamples = schema.examples || [];
        schemaOperators = schema.available_operators || [];
        schemaNotes = schema.notes || [];
      } else {
        // No fallback - just log the error
        console.error("Unexpected schema format:", schema);
        console.error(
          "Expected object_types array but got:",
          typeof schema.object_types,
        );
        schemaError =
          "Unexpected schema format received from API. Expected 'object_types' array.";
      }
      schemaLoading = false;
    } catch (err) {
      console.error("!!! EXCEPTION IN SCHEMA FETCH !!!");
      console.error("Error type:", typeof err);
      console.error("Error constructor:", err?.constructor?.name);
      console.error("Error object:", err);
      console.error("Error string:", String(err));

      schemaError = String(err);
      schemaLoading = false;
    }
  }

  // Call fetchSchema on mount
  $effect(() => {
    fetchSchema();
  });

  let expandedObjects = $state<Set<string>>(new Set());

  function toggleObject(objectName: string) {
    if (expandedObjects.has(objectName)) {
      expandedObjects.delete(objectName);
    } else {
      expandedObjects.add(objectName);
    }
    expandedObjects = new Set(expandedObjects);
  }

  // Debounced validation function
  async function validateRuleCode(code: string) {
    if (!code.trim()) {
      validationStatus = "idle";
      validationError = null;
      return;
    }

    validationStatus = "validating";

    try {
      const response = await fetch("/proxy/obp/v6.0.0/management/abac-rules/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rule_code: code }),
      });

      const result = await response.json();

      if (result.valid) {
        validationStatus = "valid";
        validationError = null;
        validationDetails = null;
      } else {
        validationStatus = "invalid";
        validationError =
          result.message || "Rule validation failed";
        validationDetails = null;
      }
    } catch (err) {
      validationStatus = "invalid";
      validationError =
        err instanceof Error ? err.message : "Validation request failed";
      validationDetails = err;
    }
  }

  // Watch for rule code changes and validate with debounce
  $effect(() => {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    if (formRuleCode.trim()) {
      validationTimeout = setTimeout(() => {
        validateRuleCode(formRuleCode);
      }, 800); // 800ms debounce
    } else {
      validationStatus = "idle";
      validationError = null;
    }

    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  });

  function insertFieldReference(objectName: string, fieldName: string) {
    const reference = `${objectName}.${fieldName}`;

    if (ruleCodeTextarea) {
      const start = ruleCodeTextarea.selectionStart;
      const end = ruleCodeTextarea.selectionEnd;
      const text = formRuleCode;

      formRuleCode = text.substring(0, start) + reference + text.substring(end);

      // Set cursor position after inserted text
      setTimeout(() => {
        if (ruleCodeTextarea) {
          const newPosition = start + reference.length;
          ruleCodeTextarea.selectionStart = newPosition;
          ruleCodeTextarea.selectionEnd = newPosition;
          ruleCodeTextarea.focus();
        }
      }, 0);
    }
  }

  // Group examples by category for organized display
  // schemaExamples now comes from the API with structure: { category, title, code, description }
  const examplesByCategory = $derived(() => {
    const grouped = new Map<string, typeof schemaExamples>();
    schemaExamples.forEach((example) => {
      const category = example.category || "Other";
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(example);
    });
    return grouped;
  });

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

      const response = await fetch(`/backend/abac-rules/${data.ruleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update ABAC rule",
        );
        logErrorDetails("Update ABAC Rule", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the rules list
      goto("/abac/rules");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update ABAC rule";
      formError = errorMsg;
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/abac/rules");
  }
</script>

<svelte:head>
  <title>Edit ABAC Rule - API Manager II</title>
</svelte:head>

  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <button
        onclick={handleCancel}
        class="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft size={16} />
        Back to Rules
      </button>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Edit ABAC Rule
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Update the Attribute-Based Access Control rule
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Object Browser Sidebar -->
      <div class="lg:col-span-1">
        <div
          class="rounded-lg bg-white p-4 shadow-md dark:bg-gray-800 sticky top-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Available Objects
            </h3>
            <button
              type="button"
              onclick={() => fetchSchema()}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Refresh schema"
              disabled={schemaLoading}
            >
              <RefreshCw
                size={16}
                class={schemaLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-4">
            Click fields to insert into rule code
          </p>

          {#if schemaLoading}
            <div class="flex items-center justify-center py-8">
              <Loader2 class="animate-spin text-blue-500" size={24} />
              <span class="ml-2 text-sm text-gray-600 dark:text-gray-400"
                >Loading schema...</span
              >
            </div>
          {:else if schemaError}
            <div
              class="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20"
            >
              <div class="flex items-start justify-between mb-2">
                <p class="text-xs text-red-800 dark:text-red-200 font-semibold">
                  Schema Fetch Error - FULL UNFILTERED ERROR BELOW
                </p>
                <button
                  type="button"
                  onclick={async () => {
                    const errorText = schemaError || "Schema fetch error";
                    await navigator.clipboard.writeText(errorText);
                    copiedSchemaError = true;
                    setTimeout(() => {
                      copiedSchemaError = false;
                    }, 2000);
                  }}
                  class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  title="Copy error to clipboard"
                >
                  {#if copiedSchemaError}
                    <CheckCircle size={14} class="text-green-600" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
              </div>
              <div class="text-xs text-red-700 dark:text-red-300 mb-2">
                <pre
                  class="whitespace-pre-wrap font-mono text-xs bg-red-100 dark:bg-red-950 p-2 rounded">{schemaError}</pre>
              </div>
              <div class="mt-2 space-y-2">
                <button
                  type="button"
                  onclick={() => fetchSchema()}
                  class="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 rounded border border-red-300 dark:border-red-700"
                >
                  Retry fetch schema
                </button>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Check browser console for additional error details
                </p>
              </div>
            </div>
          {/if}

          <div class="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto mb-4">
            {#each availableObjects as obj, index}
              {#if index > 0 && availableObjects[index - 1].isParameter && !obj.isParameter}
                <div class="pt-4 pb-2">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    <span
                      class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    >
                      Object Types
                    </span>
                    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                </div>
              {/if}
              {#if index === 0 && obj.isParameter}
                <div class="pb-2">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    <span
                      class="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide"
                    >
                      Parameters (Available in Rules)
                    </span>
                    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                </div>
              {/if}
              <div class="border border-gray-200 dark:border-gray-700 rounded">
                <button
                  type="button"
                  onclick={() => toggleObject(obj.name)}
                  class="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-mono text-blue-600 dark:text-blue-400">
                        {obj.name}
                      </div>
                      {#if obj.isParameter}
                        <span
                          class="px-1.5 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        >
                          Parameter
                        </span>
                        {#if obj.category}
                          <span
                            class="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          >
                            {obj.category}
                          </span>
                        {/if}
                      {/if}
                    </div>
                    <div
                      class="text-gray-500 dark:text-gray-400 text-xs mt-0.5"
                    >
                      {obj.description}
                    </div>
                  </div>
                  <span class="text-gray-400"
                    >{expandedObjects.has(obj.name) ? "−" : "+"}</span
                  >
                </button>

                {#if expandedObjects.has(obj.name)}
                  <div
                    class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  >
                    {#each obj.fields as field}
                      <button
                        type="button"
                        onclick={() =>
                          insertFieldReference(obj.name, field.name)}
                        class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <div class="flex items-start gap-2">
                          <Copy
                            size={12}
                            class="text-gray-400 mt-0.5 flex-shrink-0"
                          />
                          <div class="flex-1 min-w-0">
                            <div
                              class="font-mono text-xs text-gray-900 dark:text-gray-100"
                            >
                              {field.name}
                            </div>
                            <div
                              class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                            >
                              {field.description}
                            </div>
                            <div
                              class="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
                            >
                              {field.type}
                            </div>
                          </div>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          {#if schemaOperators.length > 0}
            <div
              class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <p
                class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Available Operators
              </p>
              <div class="flex flex-wrap gap-1">
                {#each schemaOperators as operator}
                  <code
                    class="inline-block px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-800 rounded font-mono text-gray-800 dark:text-gray-200"
                  >
                    {operator}
                  </code>
                {/each}
              </div>
            </div>
          {/if}

          {#if schemaExamples.length > 0}
            <div
              class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
            >
              <p
                class="text-xs font-semibold text-green-800 dark:text-green-200 mb-2"
              >
                Examples
              </p>
              <div class="space-y-1">
                {#each schemaExamples as example}
                  <button
                    type="button"
                    onclick={() => {
                      formRuleCode = example.code;
                      if (ruleCodeTextarea) {
                        ruleCodeTextarea.focus();
                      }
                    }}
                    class="block w-full text-left px-2 py-1 text-xs bg-green-100 dark:bg-green-950 rounded hover:bg-green-200 dark:hover:bg-green-900 text-green-900 dark:text-green-100"
                    title={example.description || ""}
                  >
                    <div class="font-semibold">{example.title}</div>
                    <div
                      class="font-mono text-xxs mt-0.5 break-all whitespace-pre-wrap"
                    >
                      {example.code}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if schemaNotes.length > 0}
            <div
              class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
            >
              <p
                class="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2"
              >
                Notes
              </p>
              <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                {#each schemaNotes as note}
                  <li class="list-disc ml-4">{note}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>

      <!-- Main Form -->
      <div class="lg:col-span-2">
        <div
          class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800 dark:shadow-gray-900/50"
        >
          {#if formError}
            <div
              class="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            >
              <AlertCircle
                class="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
                size={20}
              />
              <p class="text-sm text-red-800 dark:text-red-200">{formError}</p>
            </div>
          {/if}

          <!-- Info Banner -->
          <div
            class="mb-6 flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
          >
            <Info
              class="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
              size={20}
            />
            <div class="text-sm text-blue-800 dark:text-blue-200">
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
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Rule Name <span class="text-red-600">*</span>
                </label>
                <input
                  id="rule_name"
                  type="text"
                  bind:value={formRuleName}
                  required
                  placeholder="e.g., admin_only"
                  class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  A unique identifier for this rule
                </p>
              </div>

              <!-- Rule Code Field -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label
                    for="rule_code"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Rule Code <span class="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onclick={() => (showExamples = !showExamples)}
                    class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {showExamples ? "Hide" : "Show"} Examples
                  </button>
                </div>

                {#if showExamples}
                  <div
                    class="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {#if schemaExamples.length === 0}
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        No examples available. Fetch schema to load examples.
                      </p>
                    {:else}
                      <p
                        class="mb-3 text-xs font-medium text-gray-700 dark:text-gray-300"
                      >
                        Example Rule Codes (organized by category):
                      </p>
                      <div class="space-y-3 max-h-96 overflow-y-auto">
                        {#each [...examplesByCategory()] as [category, examples]}
                          <div class="space-y-2">
                            <div
                              class="sticky top-0 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-semibold text-gray-700 dark:text-gray-300"
                            >
                              {category}
                            </div>
                            {#each examples as example}
                              <div
                                class="rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800 ml-2"
                              >
                                <div
                                  class="mb-1 flex items-center justify-between"
                                >
                                  <span
                                    class="text-xs font-medium text-gray-700 dark:text-gray-300"
                                  >
                                    {example.title}
                                  </span>
                                  <button
                                    type="button"
                                    onclick={() => insertExample(example.code)}
                                    class="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    Use this
                                  </button>
                                </div>
                                <code
                                  class="block text-xs text-gray-600 dark:text-gray-400 break-all"
                                >
                                  {example.code}
                                </code>
                                {#if example.description}
                                  <p
                                    class="mt-1 text-xs text-gray-500 dark:text-gray-500"
                                  >
                                    {example.description}
                                  </p>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}

                <div class="relative">
                  <Code class="absolute left-3 top-3 text-gray-400" size={18} />
                  <textarea
                    id="rule_code"
                    bind:this={ruleCodeTextarea}
                    bind:value={formRuleCode}
                    required
                    rows="6"
                    spellcheck="false"
                    placeholder="e.g., AuthenticatedUser.emailAddress.contains('admin')"
                    class="w-full rounded-lg border {validationStatus ===
                    'invalid'
                      ? 'border-red-500'
                      : validationStatus === 'valid'
                        ? 'border-green-500'
                        : 'border-gray-300'} bg-white py-2 pl-10 pr-10 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
                  ></textarea>

                  <!-- Validation Status Icon -->
                  <div class="absolute right-3 top-3">
                    {#if validationStatus === "validating"}
                      <Loader2 class="animate-spin text-blue-500" size={18} />
                    {:else if validationStatus === "valid"}
                      <CheckCircle class="text-green-500" size={18} />
                    {:else if validationStatus === "invalid"}
                      <XCircle class="text-red-500" size={18} />
                    {/if}
                  </div>
                </div>

                <!-- Validation Messages -->
                {#if validationStatus === "valid"}
                  <p
                    class="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
                  >
                    <CheckCircle size={12} />
                    Rule code is valid
                  </p>
                {:else if validationStatus === "invalid" && validationError}
                  <div
                    class="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20"
                  >
                    <div class="flex items-start justify-between mb-2">
                      <p
                        class="text-xs text-red-600 dark:text-red-400 flex items-start gap-1 font-semibold"
                      >
                        <XCircle size={14} class="mt-0.5 shrink-0" />
                        <span>Validation Error</span>
                      </p>
                      <button
                        type="button"
                        onclick={async () => {
                          const errorText = validationDetails
                            ? JSON.stringify(validationDetails, null, 2)
                            : validationError || "Validation error";
                          await navigator.clipboard.writeText(errorText);
                          copiedValidationError = true;
                          setTimeout(() => {
                            copiedValidationError = false;
                          }, 2000);
                        }}
                        class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 relative"
                        title="Copy error to clipboard"
                      >
                        {#if copiedValidationError}
                          <CheckCircle size={14} class="text-green-600" />
                        {:else}
                          <Copy size={14} />
                        {/if}
                      </button>
                    </div>
                    <div class="ml-5 space-y-2">
                      <p class="text-xs text-red-700 dark:text-red-300">
                        {validationError}
                      </p>
                      {#if validationDetails}
                        <details class="text-xs">
                          <summary
                            class="cursor-pointer text-red-600 dark:text-red-400 hover:underline"
                          >
                            Show full error details
                          </summary>
                          <pre
                            class="mt-2 overflow-x-auto rounded bg-red-100 dark:bg-red-950 p-2 text-xs text-red-900 dark:text-red-200">{JSON.stringify(
                              validationDetails,
                              null,
                              2,
                            )}</pre>
                        </details>
                      {/if}
                    </div>
                  </div>
                {:else if validationStatus === "validating"}
                  <p
                    class="mt-1 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  >
                    <Loader2 size={12} class="animate-spin" />
                    Validating rule...
                  </p>
                {:else}
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Click fields from the sidebar to insert references, or type
                    your own expression
                  </p>
                {/if}
              </div>

              <!-- Description Field -->
              <div>
                <label
                  for="description"
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  bind:value={formDescription}
                  rows="3"
                  placeholder="Only allow access to users with admin email"
                  class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
                ></textarea>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  A human-readable description of what this rule does
                </p>
              </div>

              <!-- Policy Field -->
              <div>
                <label
                  for="policy"
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Policy <span class="text-red-600">*</span>
                </label>
                <input
                  id="policy"
                  type="text"
                  bind:value={formPolicy}
                  required
                  placeholder="e.g., account-access"
                  class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Policy this Rule supports
                </p>
              </div>

              <!-- Is Active Checkbox -->
              <div
                class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <label class="flex items-start">
                  <input
                    type="checkbox"
                    bind:checked={formIsActive}
                    class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <div class="ml-3">
                    <span
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Rule is Active
                    </span>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      When active, this rule will be evaluated for access
                      control decisions. Inactive rules are ignored but remain
                      in the system.
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
                class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
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
                    Updating...
                  </span>
                {:else}
                  Update ABAC Rule
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
