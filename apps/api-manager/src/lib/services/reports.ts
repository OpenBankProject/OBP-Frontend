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

/**
 * A chart a report asks the Manager to draw from its own rows. Declarative on purpose:
 * the definition never renders anything itself, the host draws with its own chart code.
 */
export interface ReportChartSpec {
  /** pie is drawn as a donut: one series, slices beyond the largest 7 fold into "Other". */
  type: "bar" | "line" | "stacked-bar" | "pie";
  /** Column holding the category or x value (text or date). */
  x: string;
  /** Numeric column(s); each one is a series. */
  y: string | string[];
  title?: string;
  /** bar/stacked-bar only: categories down the side, values across. Default true when > 8 categories. */
  horizontal?: boolean;
  /** Axis label for the value side, e.g. "EUR" or "calls". */
  yLabel?: string;
}

/** What a report's run(params, obp) may return. */
export interface ReportResult {
  title?: string;
  columns?: string[];
  rows?: unknown[][];
  items?: Record<string, unknown>[];
  note?: string;
  charts?: ReportChartSpec[];
}

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}
export interface ChartData {
  categories: string[];
  series: ChartSeries[];
  /** Why the chart cannot be drawn, when it cannot. */
  problem?: string;
}

const MAX_SERIES = 8;
const MAX_CATEGORIES = 60;
const MAX_SLICES = 8;
export const CHART_TYPES = ["bar", "line", "stacked-bar", "pie"] as const;

/** Raw (unstringified) rows of a result as objects keyed by column, so charts can read numbers. */
export function resultToRecords(result: ReportResult): Record<string, unknown>[] {
  if (Array.isArray(result?.items)) return result.items.map((i) => i ?? {});
  const columns = Array.isArray(result?.columns) ? result.columns.map(String) : [];
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows.map((r) => {
    const arr = Array.isArray(r) ? r : [r];
    const rec: Record<string, unknown> = {};
    arr.forEach((v, i) => (rec[columns[i] ?? `column_${i + 1}`] = v));
    return rec;
  });
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Resolve a chart spec against the result. Never throws: problems come back as `problem`. */
export function chartData(result: ReportResult, spec: ReportChartSpec): ChartData {
  if (!(CHART_TYPES as readonly string[]).includes(String(spec.type))) {
    return { categories: [], series: [], problem: `chart.type "${spec.type}" is not supported (use ${CHART_TYPES.join(", ")})` };
  }
  const records = resultToRecords(result);
  const yCols = (Array.isArray(spec.y) ? spec.y : [spec.y]).map(String).filter(Boolean);
  const known = new Set(records.flatMap((r) => Object.keys(r)));
  if (!spec.x || !known.has(spec.x)) return { categories: [], series: [], problem: `chart.x "${spec.x}" is not a column of the result (columns: ${[...known].join(", ")})` };
  const missing = yCols.filter((c) => !known.has(c));
  if (yCols.length === 0 || missing.length) return { categories: [], series: [], problem: `chart.y ${missing.length ? missing.map((m) => `"${m}"`).join(", ") + " is not a column of the result" : "is required"}` };
  if (yCols.length > MAX_SERIES) return { categories: [], series: [], problem: `at most ${MAX_SERIES} series per chart (got ${yCols.length}); split into several charts` };
  const limited = records.slice(0, MAX_CATEGORIES);
  const categories = limited.map((r) => String(r[spec.x] ?? ""));
  const series = yCols.map((c) => ({ name: c, values: limited.map((r) => toNumber(r[c])) }));
  if (series.every((sr) => sr.values.every((v) => v === null))) return { categories, series, problem: `no numeric values in ${yCols.join(", ")}` };
  if (spec.type === "pie") return pieData(records, spec.x, yCols);
  return { categories, series, problem: records.length > MAX_CATEGORIES ? `showing the first ${MAX_CATEGORIES} of ${records.length} rows` : undefined };
}

/** A pie is one series of non-negative shares, largest first, the tail folded into "Other". */
function pieData(records: Record<string, unknown>[], x: string, yCols: string[]): ChartData {
  const col = yCols[0];
  const notes: string[] = [];
  if (yCols.length > 1) notes.push(`a pie shows one series; using "${col}"`);
  const slices = records
    .map((r) => ({ name: String(r[x] ?? ""), value: toNumber(r[col]) ?? 0 }))
    .filter((sl) => sl.value > 0)
    .sort((a, b) => b.value - a.value);
  if (records.some((r) => (toNumber(r[col]) ?? 0) < 0)) notes.push("negative values were left out");
  let kept = slices;
  if (slices.length > MAX_SLICES) {
    const head = slices.slice(0, MAX_SLICES - 1);
    const rest = slices.slice(MAX_SLICES - 1).reduce((sum, sl) => sum + sl.value, 0);
    kept = [...head, { name: `Other (${slices.length - head.length})`, value: rest }];
    notes.push(`${slices.length - head.length} smaller slices folded into Other`);
  }
  if (kept.length === 0) return { categories: [], series: [], problem: `no positive values in ${col}` };
  return { categories: kept.map((sl) => sl.name), series: [{ name: col, values: kept.map((sl) => sl.value) }], problem: notes.join("; ") || undefined };
}

export const STARTER_DEFINITION = `// A report is an async function run(params, obp).
// - params: the values the viewer entered for the parameters below
// - obp.get(path) / obp.post(path, body): call OBP with the viewer's own access
// Return { columns, rows } or { items: [ {…}, … ] }. console.log is shown next to the result.
// Optional: charts: [{ type: 'bar' | 'line' | 'stacked-bar', x: 'column', y: 'column' | ['col1', 'col2'], title? }]
// draws the rows as a chart above the table; no charting code is needed in the definition.
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
