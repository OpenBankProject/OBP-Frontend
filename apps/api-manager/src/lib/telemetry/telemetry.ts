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
 * This module turns the response of GET /obp/v7.0.0/management/telemetry into the summaries the
 * Telemetry page shows.
 *
 * OBP-API returns every meter as a flat list: a Micrometer name, a type, tags, and measurements
 * such as `count`, `total_time` (seconds), `max` and `value`. The same meter name appears once
 * per combination of tag values, so most summaries here group by one tag and add up.
 *
 * All figures are since the answering OBP-API instance started.
 */

export interface TelemetryMeter {
  name: string;
  type: string;
  base_unit?: string | null;
  tags: Record<string, string>;
  measurements: Record<string, number>;
}

export interface TelemetryPort {
  enabled: boolean;
  port: number;
  path: string;
}

export interface TelemetryResponse {
  api_instance_id: string;
  git_commit: string;
  port: TelemetryPort;
  meters: TelemetryMeter[];
}

function metersNamed(meters: TelemetryMeter[], name: string): TelemetryMeter[] {
  return meters.filter((meter) => meter.name === name);
}

function measurement(meter: TelemetryMeter, statistic: string): number {
  return meter.measurements[statistic] ?? 0;
}

/** Adds up one measurement over every meter with this name whose tags include `tags`. */
export function sumOf(
  meters: TelemetryMeter[],
  name: string,
  statistic: string,
  tags: Record<string, string> = {},
): number {
  return metersNamed(meters, name)
    .filter((meter) => Object.entries(tags).every(([key, value]) => meter.tags[key] === value))
    .reduce((total, meter) => total + measurement(meter, statistic), 0);
}

/** The value of a single gauge, or null when OBP-API did not report it. */
export function gaugeValue(meters: TelemetryMeter[], name: string): number | null {
  const found = metersNamed(meters, name);
  return found.length > 0 && found[0].measurements.value !== undefined ? found[0].measurements.value : null;
}

// ===== The instance =====

export interface InstanceSummary {
  heapUsedBytes: number;
  /** Null when no heap pool declares a maximum. */
  heapMaxBytes: number | null;
  /** Share of the heap still in use after the last garbage collection, 0 to 1. */
  heapAfterGc: number | null;
  /** Share of recent CPU time spent in garbage collection, 0 to 1. */
  gcOverhead: number | null;
  liveThreads: number | null;
  processCpu: number | null;
  uptimeSeconds: number | null;
}

export function summariseInstance(meters: TelemetryMeter[]): InstanceSummary {
  const heapMaxima = metersNamed(meters, "jvm.memory.max")
    .filter((meter) => meter.tags.area === "heap")
    .map((meter) => measurement(meter, "value"))
    // A pool with no maximum reports -1.
    .filter((value) => value >= 0);
  return {
    heapUsedBytes: sumOf(meters, "jvm.memory.used", "value", { area: "heap" }),
    heapMaxBytes: heapMaxima.length > 0 ? heapMaxima.reduce((total, value) => total + value, 0) : null,
    heapAfterGc: gaugeValue(meters, "jvm.memory.usage.after.gc"),
    gcOverhead: gaugeValue(meters, "jvm.gc.overhead"),
    liveThreads: gaugeValue(meters, "jvm.threads.live"),
    processCpu: gaugeValue(meters, "process.cpu.usage"),
    uptimeSeconds: gaugeValue(meters, "process.uptime"),
  };
}

// ===== The database pool =====

export interface PoolSummary {
  pool: string;
  active: number;
  idle: number;
  pending: number;
  max: number;
  timeouts: number;
}

export function summarisePools(meters: TelemetryMeter[]): PoolSummary[] {
  const pools = [...new Set(metersNamed(meters, "hikaricp.connections").map((meter) => meter.tags.pool))];
  return pools.map((pool) => ({
    pool,
    active: sumOf(meters, "hikaricp.connections.active", "value", { pool }),
    idle: sumOf(meters, "hikaricp.connections.idle", "value", { pool }),
    pending: sumOf(meters, "hikaricp.connections.pending", "value", { pool }),
    max: sumOf(meters, "hikaricp.connections.max", "value", { pool }),
    timeouts: sumOf(meters, "hikaricp.connections.timeout", "count", { pool }),
  }));
}

// ===== Requests: endpoints, Connector methods, Redis commands =====

export interface RequestSummary {
  /** What was called: an operation id, a Connector method, or a Redis command. */
  key: string;
  /** For endpoints only: the API version of the group that served the call, e.g. "v7.0.0". */
  apiVersion: string | null;
  /** For Connector calls only: the Connector and its method, as the Connector Traces page filters them. */
  connector: string | null;
  connectorMethod: string | null;
  calls: number;
  /** Calls with a 4xx status (endpoints) or none (others). */
  clientErrors: number;
  /** Calls with a 5xx status (endpoints), failed Connector calls, or failed Redis commands. */
  failures: number;
  meanMillis: number;
  maxMillis: number;
}

function summariseTimer(
  meters: TelemetryMeter[],
  name: string,
  keyOf: (meter: TelemetryMeter) => string,
  apiVersionOf: (meter: TelemetryMeter) => string | null,
  isClientError: (meter: TelemetryMeter) => boolean,
  isFailure: (meter: TelemetryMeter) => boolean,
): RequestSummary[] {
  const byKey = new Map<string, { apiVersion: string | null; connector: string | null; connectorMethod: string | null; calls: number; clientErrors: number; failures: number; totalSeconds: number; maxSeconds: number }>();
  for (const meter of metersNamed(meters, name)) {
    const key = keyOf(meter);
    const entry = byKey.get(key) ?? {
      apiVersion: apiVersionOf(meter),
      connector: meter.tags.connector ?? null,
      connectorMethod: meter.tags.connector_method ?? null,
      calls: 0, clientErrors: 0, failures: 0, totalSeconds: 0, maxSeconds: 0 };
    const count = measurement(meter, "count");
    entry.calls += count;
    if (isClientError(meter)) entry.clientErrors += count;
    if (isFailure(meter)) entry.failures += count;
    entry.totalSeconds += measurement(meter, "total_time");
    entry.maxSeconds = Math.max(entry.maxSeconds, measurement(meter, "max"));
    byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .map(([key, entry]) => ({
      key,
      apiVersion: entry.apiVersion,
      connector: entry.connector,
      connectorMethod: entry.connectorMethod,
      calls: entry.calls,
      clientErrors: entry.clientErrors,
      failures: entry.failures,
      meanMillis: entry.calls > 0 ? (entry.totalSeconds / entry.calls) * 1000 : 0,
      maxMillis: entry.maxSeconds * 1000,
    }))
    .sort((left, right) => right.calls - left.calls || left.key.localeCompare(right.key));
}

/** One row per endpoint (operation id), most called first. */
export function summariseEndpoints(meters: TelemetryMeter[]): RequestSummary[] {
  return summariseTimer(
    meters,
    "obp.api.endpoint.requests",
    (meter) => meter.tags.operation,
    (meter) => meter.tags.api_version,
    (meter) => meter.tags.status === "4xx",
    (meter) => meter.tags.status === "5xx",
  );
}

/** One row per Connector method, most called first. */
export function summariseConnectorCalls(meters: TelemetryMeter[]): RequestSummary[] {
  return summariseTimer(
    meters,
    "obp.api.connector.calls",
    (meter) => `${meter.tags.connector} ${meter.tags.connector_method}`,
    () => null,
    () => false,
    (meter) => meter.tags.result === "failure",
  );
}

/** One row per Redis command, most used first. */
export function summariseRedisCommands(meters: TelemetryMeter[]): RequestSummary[] {
  return summariseTimer(
    meters,
    "obp.api.redis.commands",
    (meter) => meter.tags.command,
    () => null,
    () => false,
    (meter) => meter.tags.result === "error",
  );
}

// ===== Response sizes and list item counts, per endpoint =====

export interface ResponseShape {
  /** Mean number of items in a list response; null when the endpoint returned no list. */
  meanItems: number | null;
  maxItems: number | null;
  /** Mean response size in bytes; null when no response stated its length. */
  meanBytes: number | null;
}

function meanAndMax(meter: TelemetryMeter | undefined): { mean: number | null; max: number | null } {
  if (meter === undefined || measurement(meter, "count") === 0) return { mean: null, max: null };
  return { mean: measurement(meter, "total") / measurement(meter, "count"), max: measurement(meter, "max") };
}

/** Item counts and sizes keyed by operation id. */
export function summariseResponseShapes(meters: TelemetryMeter[]): Map<string, ResponseShape> {
  const itemsByOperation = new Map(metersNamed(meters, "obp.api.endpoint.response.items").map((meter) => [meter.tags.operation, meter]));
  const sizeByOperation = new Map(metersNamed(meters, "obp.api.endpoint.response.size").map((meter) => [meter.tags.operation, meter]));
  const operations = new Set([...itemsByOperation.keys(), ...sizeByOperation.keys()]);
  return new Map([...operations].map((operation) => {
    const items = meanAndMax(itemsByOperation.get(operation));
    return [operation, { meanItems: items.mean, maxItems: items.max, meanBytes: meanAndMax(sizeByOperation.get(operation)).mean }];
  }));
}

// ===== Link to the API Metrics page =====

/**
 * The API Metrics page filtered to recent calls of one endpoint, or null when the operation id
 * cannot be split. An operation id is "<standard><api version>-<handler name>", for example
 * "OBPv7.0.0-getBanks", and each API Metrics record stores the api version and the handler name
 * separately, so the link filters on both. `now` is passed in so the link can be tested.
 */
export function metricsSearchHref(operationId: string, apiVersion: string | null, now: Date, minutesBack = 60): string | null {
  if (apiVersion === null) return null;
  const marker = `${apiVersion}-`;
  const position = operationId.indexOf(marker);
  if (position < 0) return null;
  const handlerName = operationId.slice(position + marker.length);
  if (handlerName.length === 0) return null;
  // The Metrics page reads from_date as a UTC datetime-local value: "YYYY-MM-DDTHH:mm".
  const fromDate = new Date(now.getTime() - minutesBack * 60 * 1000).toISOString().slice(0, 16);
  const params = new URLSearchParams({
    implemented_in_version: apiVersion,
    implemented_by_partial_function: handlerName,
    from_date: fromDate,
  });
  return `/metrics?${params.toString()}`;
}

/**
 * The Connector Traces page filtered to one Connector method over the last hour, or null when the
 * row is not a Connector call. Traces carry the same Connector and method names as Telemetry.
 */
export function connectorTracesHref(connector: string | null, connectorMethod: string | null, now: Date, minutesBack = 60): string | null {
  if (connector === null || connectorMethod === null) return null;
  const params = new URLSearchParams({
    connector_name: connector,
    function_name: connectorMethod,
    from_date: new Date(now.getTime() - minutesBack * 60 * 1000).toISOString().slice(0, 16),
  });
  return `/connector-traces?${params.toString()}`;
}

// ===== Memoised calls =====

export interface MemoizeSummary {
  provider: string;
  /** "Owner.method" of the cached code, or "other" for keys a caller wrote itself. */
  cache: string;
  hits: number;
  misses: number;
  hitRatio: number | null;
}

/** One row per memoised method and provider, most used first. */
export function summariseMemoize(meters: TelemetryMeter[]): MemoizeSummary[] {
  const rows = new Map<string, MemoizeSummary>();
  for (const meter of metersNamed(meters, "obp.api.memoize.gets")) {
    const key = `${meter.tags.provider}|${meter.tags.cache}`;
    const row = rows.get(key) ?? { provider: meter.tags.provider, cache: meter.tags.cache, hits: 0, misses: 0, hitRatio: null };
    if (meter.tags.result === "hit") row.hits += measurement(meter, "count");
    if (meter.tags.result === "miss") row.misses += measurement(meter, "count");
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, hitRatio: row.hits + row.misses > 0 ? row.hits / (row.hits + row.misses) : null }))
    .sort((left, right) => right.hits + right.misses - (left.hits + left.misses) || left.cache.localeCompare(right.cache));
}

// ===== Batch writers =====

export interface BatchWriterSummary {
  /** "api_metrics" or "connector_metrics". */
  writer: string;
  queued: number;
  written: number;
  lost: number;
  queueDepth: number | null;
  failedFlushes: number;
  meanFlushMillis: number;
}

export function summariseBatchWriters(meters: TelemetryMeter[]): BatchWriterSummary[] {
  const writers = [...new Set(metersNamed(meters, "obp.api.batch_writer.rows").map((meter) => meter.tags.writer))].sort();
  return writers.map((writer) => {
    const flushes = sumOf(meters, "obp.api.batch_writer.flushes", "count", { writer });
    const flushSeconds = sumOf(meters, "obp.api.batch_writer.flushes", "total_time", { writer });
    const depth = metersNamed(meters, "obp.api.batch_writer.queue.depth").find((meter) => meter.tags.writer === writer);
    return {
      writer,
      queued: sumOf(meters, "obp.api.batch_writer.rows", "count", { writer, result: "queued" }),
      written: sumOf(meters, "obp.api.batch_writer.rows", "count", { writer, result: "written" }),
      lost: sumOf(meters, "obp.api.batch_writer.rows", "count", { writer, result: "lost" }),
      queueDepth: depth === undefined ? null : measurement(depth, "value"),
      failedFlushes: sumOf(meters, "obp.api.batch_writer.flushes", "count", { writer, result: "failure" }),
      meanFlushMillis: flushes > 0 ? (flushSeconds / flushes) * 1000 : 0,
    };
  });
}

// ===== Other OBP-API counters =====

export interface OtherCounter {
  id: string;
  label: string;
  value: number | null;
}

/** Single figures that belong to no table: stream drops, Redis log shipping, generated documents. */
export function summariseOtherCounters(meters: TelemetryMeter[]): OtherCounter[] {
  return [
    { id: "metrics-stream-dropped", label: "API Metrics stream messages dropped", value: sumOf(meters, "obp.api.stream.messages.dropped", "count", { stream: "metrics" }) },
    { id: "log-cache-stream-dropped", label: "Log cache stream messages dropped", value: sumOf(meters, "obp.api.stream.messages.dropped", "count", { stream: "log_cache" }) },
    { id: "redis-logger-failures", label: "Redis log shipping failures in a row", value: gaugeValue(meters, "obp.api.redis_logger.consecutive_failures") },
    { id: "json-schema-generations", label: "Connector JSON Schemas generated", value: sumOf(meters, "obp.api.json_schema.generations", "count") },
    { id: "message-docs-generations", label: "Message docs responses generated", value: sumOf(meters, "obp.api.message_docs.generations", "count") },
    { id: "message-docs-shared-hits", label: "Message docs found in the shared cache", value: sumOf(meters, "obp.api.message_docs.shared.gets", "count", { result: "hit" }) },
  ];
}

// ===== Caches =====

export interface CacheSummary {
  cache: string;
  hits: number;
  misses: number;
  /** Null until the cache has been read at least once. */
  hitRatio: number | null;
  size: number;
  evictions: number;
}

export function summariseCaches(meters: TelemetryMeter[]): CacheSummary[] {
  const caches = [...new Set(metersNamed(meters, "cache.gets").map((meter) => meter.tags.cache))].sort();
  return caches.map((cache) => {
    const hits = sumOf(meters, "cache.gets", "count", { cache, result: "hit" });
    const misses = sumOf(meters, "cache.gets", "count", { cache, result: "miss" });
    return {
      cache,
      hits,
      misses,
      hitRatio: hits + misses > 0 ? hits / (hits + misses) : null,
      size: sumOf(meters, "cache.size", "value", { cache }),
      evictions: sumOf(meters, "cache.evictions", "count", { cache }),
    };
  });
}

// ===== Logging =====

export interface LoggingSummary {
  queueDepth: number | null;
  dispatched: number;
  dropped: number;
  inline: number;
  maskingCalls: number;
}

export function summariseLogging(meters: TelemetryMeter[]): LoggingSummary {
  return {
    queueDepth: gaugeValue(meters, "obp.api.log.dispatch.queue.depth"),
    dispatched: sumOf(meters, "obp.api.log.dispatch.entries", "count", { result: "dispatched" }),
    dropped: sumOf(meters, "obp.api.log.dispatch.entries", "count", { result: "dropped" }),
    inline: sumOf(meters, "obp.api.log.dispatch.entries", "count", { result: "inline" }),
    maskingCalls: sumOf(meters, "obp.api.log.masking.calls", "count"),
  };
}

// ===== Formatting =====

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatShare(share: number | null): string {
  return share === null ? "—" : `${(share * 100).toFixed(1)}%`;
}

export function formatMillis(millis: number): string {
  return millis >= 1000 ? `${(millis / 1000).toFixed(2)} s` : `${millis.toFixed(1)} ms`;
}

export function formatCount(value: number | null): string {
  return value === null ? "—" : Math.round(value).toLocaleString();
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}
