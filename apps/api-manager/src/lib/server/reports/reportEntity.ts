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
import REPORT from "$lib/data/reportEntity.json";
import { ensureSystemDynamicEntity, recordsFromListResponse, unwrapRecord, slugify } from "$lib/server/dynamicEntities/ensure";

export const REPORT_ENTITY = REPORT.entity_name; // "obp_report"
export const REPORT_DATA_PATH = `/obp/dynamic-entity/${REPORT_ENTITY}`;
export const REPORT_ID_FIELD = `${REPORT_ENTITY}_id`;

export function createReportDynamicEntityIfNeeded(): Promise<boolean> {
  return ensureSystemDynamicEntity(REPORT);
}

export interface ReportRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  definition: string;
  parameters: string;
  author: string;
  updated_at: string;
}

export function toReportRecord(input: any): ReportRecord {
  const raw = unwrapRecord(REPORT_ENTITY, input);
  return {
    id: String(raw?.[REPORT_ID_FIELD] ?? raw?.id ?? ""),
    slug: String(raw?.slug ?? ""),
    title: String(raw?.title ?? ""),
    description: String(raw?.description ?? ""),
    definition: String(raw?.definition ?? ""),
    parameters: String(raw?.parameters ?? "[]"),
    author: String(raw?.author ?? ""),
    updated_at: String(raw?.updated_at ?? ""),
  };
}

export { recordsFromListResponse };

/** Validate and normalise a report body from the editor. */
export function normaliseReportBody(body: any, username: string): { ok: true; data: Record<string, string> } | { ok: false; message: string } {
  const title = String(body?.title ?? "").trim();
  if (!title) return { ok: false, message: "title is required" };
  const slug = slugify(String(body?.slug ?? "").trim() || title);
  if (!slug) return { ok: false, message: "slug is required" };
  const definition = String(body?.definition ?? "");
  if (!definition.trim()) return { ok: false, message: "definition is required" };
  if (definition.length > 200000) return { ok: false, message: "definition is larger than 200000 characters" };
  let parameters = String(body?.parameters ?? "[]").trim() || "[]";
  try {
    const parsed = JSON.parse(parameters);
    if (!Array.isArray(parsed)) return { ok: false, message: "parameters must be a JSON array" };
    parameters = JSON.stringify(parsed);
  } catch {
    return { ok: false, message: "parameters is not valid JSON" };
  }
  const description = String(body?.description ?? "").slice(0, 2000);
  return {
    ok: true,
    data: { slug, title, description, definition, parameters, author: username, updated_at: new Date().toISOString().split(".")[0] + "Z" },
  };
}
