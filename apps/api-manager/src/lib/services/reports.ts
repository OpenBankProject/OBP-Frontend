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
 * Client-side helpers for the Reports page: record types, fetch/save/delete through
 * /backend/reports, the parameter schema a report declares, and how a report definition
 * is wrapped into the HTML document that runs it inside the sandboxed frame.
 */

export interface ReportParameter {
  name: string;
  label?: string;
  type?: "string" | "number" | "date" | "bank_id" | "boolean";
  default?: string | number | boolean;
  required?: boolean;
  description?: string;
}

export interface ReportSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  parameters: string;
  author: string;
  updated_at: string;
  definition_length?: number;
}

export interface ReportRecord extends ReportSummary {
  definition: string;
}

export interface ReportFormValues {
  slug: string;
  title: string;
  description: string;
  definition: string;
  /** JSON array text of ReportParameter. */
  parameters: string;
}

/** What a report's run(params, obp) may return. */
export interface ReportResult {
  title?: string;
  columns?: string[];
  rows?: unknown[][];
  items?: Record<string, unknown>[];
  note?: string;
}

export const STARTER_DEFINITION = `// A report is an async function run(params, obp).
// - params: the values the viewer entered for the parameters below
// - obp.get(path) / obp.post(path, body): call OBP with the viewer's own access
// Return { columns, rows } or { items: [ {…}, … ] }. console.log is shown next to the result.
async function run(params, obp) {
  const banks = await obp.get('/obp/v6.0.0/banks');
  const limit = Number(params.limit || 10);
  return {
    title: 'Banks',
    columns: ['bank_id', 'full_name', 'website'],
    rows: banks.banks.slice(0, limit).map((b) => [b.bank_id, b.full_name, b.website || ''])
  };
}
`;

export const STARTER_PARAMETERS = JSON.stringify(
  [{ name: "limit", label: "Maximum banks", type: "number", default: 10 }],
  null,
  2,
);

export function parseParameters(text: string): { params: ReportParameter[]; error: string } {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { params: [], error: "" };
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return { params: [], error: "parameters must be a JSON array" };
    const params = parsed
      .filter((p) => p && typeof p === "object" && typeof p.name === "string" && p.name.trim())
      .map((p) => ({ ...p, name: String(p.name).trim() }) as ReportParameter);
    return { params, error: "" };
  } catch {
    return { params: [], error: "parameters is not valid JSON" };
  }
}

/** Default values for a parameter set, as the run form starts. */
export function defaultParameterValues(params: ReportParameter[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of params) values[p.name] = p.default === undefined || p.default === null ? "" : String(p.default);
  return values;
}

/** Coerce the run form's strings to the declared types before handing them to run(). */
export function coerceParameterValues(params: ReportParameter[], values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params) {
    const raw = values[p.name] ?? "";
    if (p.type === "number") out[p.name] = raw === "" ? undefined : Number(raw);
    else if (p.type === "boolean") out[p.name] = raw === "true" || raw === "on" || raw === "1";
    else out[p.name] = raw;
  }
  return out;
}

/**
 * The HTML document that runs a definition in the sandboxed frame. The frame's injected
 * `obp` object carries the calls; the result comes back through obp.emit('report:result').
 * The definition is inserted as script text, so a stray "</script>" is neutralised first.
 */
export function buildRunnerDocument(definition: string, params: Record<string, unknown>): string {
  const safeDefinition = definition.replace(/<\/script/gi, "<\\/script");
  const paramsJson = JSON.stringify(params).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
${safeDefinition}
</script>
<script>
(async function () {
  var params = ${paramsJson};
  try {
    if (typeof run !== 'function') throw new Error('The definition must declare async function run(params, obp)');
    var result = await run(params, window.obp);
    window.obp.emit('report:result', result);
  } catch (e) {
    window.obp.emit('report:error', { message: (e && e.message) || String(e), stack: e && e.stack ? String(e.stack).slice(0, 2000) : '' });
  }
})();
</script>
</body></html>`;
}

/** Normalise a run result into a table. */
export function resultToTable(result: ReportResult): { columns: string[]; rows: string[][] } {
  if (Array.isArray(result?.items)) {
    const columns = Array.from(new Set(result.items.flatMap((item) => Object.keys(item ?? {}))));
    const rows = result.items.map((item) => columns.map((c) => cell(item?.[c])));
    return { columns, rows };
  }
  const columns = Array.isArray(result?.columns) ? result.columns.map(String) : [];
  const rows = Array.isArray(result?.rows) ? result.rows.map((r) => (Array.isArray(r) ? r : [r]).map(cell)) : [];
  if (columns.length === 0 && rows.length > 0) {
    return { columns: rows[0].map((_, i) => `column_${i + 1}`), rows };
  }
  return { columns, rows };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function tableToCsv(columns: string[], rows: string[][]): string {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
  return body;
}

export const fetchReports = async (): Promise<ReportSummary[]> => (await getJson("/backend/reports")).reports ?? [];
export const fetchReport = async (id: string): Promise<ReportRecord> => (await getJson(`/backend/reports/${encodeURIComponent(id)}`)).report;
export async function saveReport(id: string | null, values: ReportFormValues): Promise<ReportRecord> {
  const body = await getJson(id ? `/backend/reports/${encodeURIComponent(id)}` : "/backend/reports", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  return body.report;
}
export const deleteReport = (id: string): Promise<any> => getJson(`/backend/reports/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Create a separate copy of a saved report ("Copy of …", slug suffixed -copy) and return the new record. */
export async function duplicateReport(source: ReportFormValues): Promise<ReportRecord> {
  return saveReport(null, {
    ...source,
    title: `Copy of ${source.title}`.slice(0, 200),
    slug: `${source.slug || "report"}-copy`.slice(0, 120),
  });
}
