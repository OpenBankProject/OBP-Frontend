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
 * Domain APIs: one space's Dynamic Entities and Dynamic Resource Docs published under a base path
 * of its own (e.g. /carbon-registry/v1/activity). Managed through the v7.0.0 endpoints at
 * /management/banks/BANK_ID/domain-apis, where BANK_ID is a bank's id or SYS for the system space.
 * Browser calls go through the generic OBP proxy; server loads use domainApisPath directly.
 */
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";

export interface DomainApi {
  domain_api_id: string;
  bank_id: string;
  base_path: string;
  version: string;
  title: string;
  description: string;
  url: string;
  openapi_url: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DomainApiFormValues {
  base_path: string;
  version: string;
  title: string;
  description: string;
}

/** The space a page works on: a bank id, or SYS when none is given. */
export function spaceOf(bankId: string | null | undefined): string {
  return bankId?.trim() || DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;
}

/** `/obp/v7.0.0/management/banks/BANK_ID/domain-apis[/DOMAIN_API_ID]` */
export function domainApisPath(bankId: string, domainApiId?: string): string {
  const base = `/obp/v7.0.0/management/banks/${encodeURIComponent(spaceOf(bankId))}/domain-apis`;
  return domainApiId ? `${base}/${encodeURIComponent(domainApiId)}` : base;
}

/** The first segments OBP serves itself, mirroring DomainApiPaths.reservedFirstSegments (the BG and UK prefixes are left to OBP). */
const RESERVED_FIRST_SEGMENTS = new Set([
  "obp", "open-banking", "my", "apps", "status", "health", "alive", "banks", "oauth", "dauth", "siwe",
  ".well-known", "static", "openapi.json", "openapi.yaml",
]);
const SEGMENT = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const MAJOR_SEGMENT = /^v(0|[1-9][0-9]*)$/;
const SEMANTIC_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** Why OBP would refuse this base path, or "" when it looks acceptable. OBP has the final say. */
export function basePathProblem(basePath: string): string {
  const segments = basePath.split("/");
  if (segments.length < 2 || segments.length > 5) return "It must have two to five segments, e.g. carbon-registry/v1.";
  if (!segments.every((s) => SEGMENT.test(s))) return "Each segment must be lowercase letters, digits, hyphens or dots.";
  if (RESERVED_FIRST_SEGMENTS.has(segments[0])) return `Its first segment, ${segments[0]}, is one OBP serves.`;
  if (!MAJOR_SEGMENT.test(segments[segments.length - 1])) return "Its last segment must be the major version, vN.";
  return "";
}

/** The N of the vN that ends a base path, or null. */
export function majorOf(basePath: string): number | null {
  const m = basePath.split("/").pop()?.match(MAJOR_SEGMENT);
  return m ? Number(m[1]) : null;
}

/** Why OBP would refuse this version for this base path, or "". */
export function versionProblem(version: string, basePath: string): string {
  const m = version.match(SEMANTIC_VERSION);
  if (!m) return "It must be MAJOR.MINOR.PATCH, e.g. 1.0.0.";
  const major = majorOf(basePath);
  if (major !== null && Number(m[1]) !== major) return `Its major version must be ${major}, the v${major} that ends the base path.`;
  return "";
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body?.message ?? `${fallback} (HTTP ${response.status})`;
}

function bodyOf(values: DomainApiFormValues): string {
  return JSON.stringify({
    base_path: values.base_path,
    version: values.version,
    title: values.title,
    ...(values.description ? { description: values.description } : {}),
  });
}

export async function createDomainApi(bankId: string, values: DomainApiFormValues): Promise<DomainApi> {
  const response = await fetch(`/proxy${domainApisPath(bankId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: bodyOf(values),
  });
  if (!response.ok) throw new Error(await readError(response, "Failed to create the Domain API"));
  return response.json();
}

export async function updateDomainApi(bankId: string, domainApiId: string, values: DomainApiFormValues): Promise<DomainApi> {
  const response = await fetch(`/proxy${domainApisPath(bankId, domainApiId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: bodyOf(values),
  });
  if (!response.ok) throw new Error(await readError(response, "Failed to update the Domain API"));
  return response.json();
}

export async function deleteDomainApi(bankId: string, domainApiId: string): Promise<void> {
  const response = await fetch(`/proxy${domainApisPath(bankId, domainApiId)}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, "Failed to delete the Domain API"));
}
