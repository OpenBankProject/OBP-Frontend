/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Client-side helpers for JSON Schema Validations: OBP applies a JSON Schema to the request
 * body of one endpoint, identified by its operation_id. All calls go through the generic OBP proxy.
 */

export interface JsonSchemaValidation {
  operation_id: string;
  json_schema: Record<string, unknown>;
}

export interface JsonSchemaValidationFormValues {
  operation_id: string;
  /** Pretty JSON text of the schema; the form validates it parses to an object. */
  json_schema: string;
}

/** One endpoint an operation_id can point at, from the resource docs. */
export interface OperationChoice {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
}

const BASE = "/proxy/obp/v4.0.0/management/json-schema-validations";

export const EXAMPLE_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema",
  "title": "Request body rules",
  "type": "object",
  "required": ["xxx_id"],
  "properties": {
    "xxx_id": { "type": "string", "minLength": 2, "maxLength": 50 }
  },
  "additionalProperties": true
}`;

export function schemaToText(schema: unknown): string {
  if (schema == null) return "";
  if (typeof schema === "string") return schema;
  return JSON.stringify(schema, null, 2);
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body?.message ?? `${fallback} (HTTP ${response.status})`;
}

export async function fetchJsonSchemaValidations(): Promise<JsonSchemaValidation[]> {
  const response = await fetch(BASE, { credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, "Failed to load JSON Schema Validations"));
  const data = await response.json();
  return data.json_schema_validations ?? [];
}

export async function fetchJsonSchemaValidation(operationId: string): Promise<JsonSchemaValidation> {
  const response = await fetch(`${BASE}/${encodeURIComponent(operationId)}`, { credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, "Failed to load the JSON Schema Validation"));
  return response.json();
}

/** POST creates, PUT updates: OBP keys the validation by operation_id, so the caller says which. */
export async function saveJsonSchemaValidation(values: JsonSchemaValidationFormValues, isUpdate: boolean): Promise<JsonSchemaValidation> {
  const response = await fetch(`${BASE}/${encodeURIComponent(values.operation_id)}`, {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: values.json_schema,
  });
  if (!response.ok) throw new Error(await readError(response, "Failed to save the JSON Schema Validation"));
  return response.json();
}

export async function deleteJsonSchemaValidation(operationId: string): Promise<void> {
  const response = await fetch(`${BASE}/${encodeURIComponent(operationId)}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, "Failed to delete the JSON Schema Validation"));
}
