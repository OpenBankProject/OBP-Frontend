import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDuration,
  formatShare,
  metricsSearchHref,
  connectorTracesHref,
  summariseBatchWriters,
  summariseMemoize,
  summariseResponseShapes,
  summariseCaches,
  summariseConnectorCalls,
  summariseEndpoints,
  summariseInstance,
  summariseLogging,
  summarisePools,
  type TelemetryMeter,
} from "./telemetry";

function meter(name: string, type: string, tags: Record<string, string>, measurements: Record<string, number>): TelemetryMeter {
  return { name, type, base_unit: null, tags, measurements };
}

describe("summariseEndpoints", () => {
  it("adds up an operation's status classes and ranks the most called first", () => {
    const meters = [
      meter("obp.api.endpoint.requests", "timer", { operation: "OBPv7.0.0-getBanks", api_version: "v7.0.0", status: "2xx" },
        { count: 8, total_time: 0.4, max: 0.09 }),
      meter("obp.api.endpoint.requests", "timer", { operation: "OBPv7.0.0-getBanks", api_version: "v7.0.0", status: "5xx" },
        { count: 2, total_time: 0.6, max: 0.5 }),
      meter("obp.api.endpoint.requests", "timer", { operation: "OBPv7.0.0-getBank", api_version: "v7.0.0", status: "4xx" },
        { count: 3, total_time: 0.03, max: 0.02 }),
    ];
    const summary = summariseEndpoints(meters);
    expect(summary.map((row) => row.key)).toEqual(["OBPv7.0.0-getBanks", "OBPv7.0.0-getBank"]);
    expect(summary[0]).toMatchObject({ calls: 10, clientErrors: 0, failures: 2, maxMillis: 500 });
    expect(summary[0].meanMillis).toBeCloseTo(100);
    expect(summary[1]).toMatchObject({ calls: 3, clientErrors: 3, failures: 0 });
  });
});

describe("summariseConnectorCalls", () => {
  it("counts failed calls per connector method", () => {
    const meters = [
      meter("obp.api.connector.calls", "timer", { connector: "star", connector_method: "getBank", result: "success" },
        { count: 5, total_time: 0.05, max: 0.02 }),
      meter("obp.api.connector.calls", "timer", { connector: "star", connector_method: "getBank", result: "failure" },
        { count: 1, total_time: 0.01, max: 0.01 }),
    ];
    expect(summariseConnectorCalls(meters)).toEqual([
      expect.objectContaining({ key: "star getBank", connector: "star", connectorMethod: "getBank", calls: 6, failures: 1 }),
    ]);
  });
});

describe("summariseCaches", () => {
  it("computes the hit ratio from hits and misses, and leaves it empty for an unread cache", () => {
    const meters = [
      meter("cache.gets", "function_counter", { cache: "json_schema", result: "hit" }, { count: 9 }),
      meter("cache.gets", "function_counter", { cache: "json_schema", result: "miss" }, { count: 1 }),
      meter("cache.size", "gauge", { cache: "json_schema" }, { value: 2 }),
      meter("cache.gets", "function_counter", { cache: "in_memory", result: "hit" }, { count: 0 }),
      meter("cache.gets", "function_counter", { cache: "in_memory", result: "miss" }, { count: 0 }),
    ];
    const summary = summariseCaches(meters);
    expect(summary.map((row) => row.cache)).toEqual(["in_memory", "json_schema"]);
    expect(summary[0].hitRatio).toBeNull();
    expect(summary[1]).toMatchObject({ hits: 9, misses: 1, hitRatio: 0.9, size: 2 });
  });
});

describe("summariseInstance", () => {
  it("adds up the heap pools and ignores a pool with no maximum", () => {
    const meters = [
      meter("jvm.memory.used", "gauge", { area: "heap", id: "G1 Eden Space" }, { value: 100 }),
      meter("jvm.memory.used", "gauge", { area: "heap", id: "G1 Old Gen" }, { value: 300 }),
      meter("jvm.memory.used", "gauge", { area: "nonheap", id: "Metaspace" }, { value: 999 }),
      meter("jvm.memory.max", "gauge", { area: "heap", id: "G1 Eden Space" }, { value: -1 }),
      meter("jvm.memory.max", "gauge", { area: "heap", id: "G1 Old Gen" }, { value: 1000 }),
      meter("jvm.memory.usage.after.gc", "gauge", { area: "heap", pool: "long-lived" }, { value: 0.25 }),
      meter("jvm.threads.live", "gauge", {}, { value: 64 }),
    ];
    expect(summariseInstance(meters)).toMatchObject({
      heapUsedBytes: 400,
      heapMaxBytes: 1000,
      heapAfterGc: 0.25,
      liveThreads: 64,
      gcOverhead: null,
    });
  });
});

describe("summarisePools and summariseLogging", () => {
  it("reads the database pool by pool name and the log dispatch counters by result", () => {
    const meters = [
      meter("hikaricp.connections", "gauge", { pool: "HikariPool-1" }, { value: 12 }),
      meter("hikaricp.connections.active", "gauge", { pool: "HikariPool-1" }, { value: 3 }),
      meter("hikaricp.connections.max", "gauge", { pool: "HikariPool-1" }, { value: 20 }),
      meter("hikaricp.connections.pending", "gauge", { pool: "HikariPool-1" }, { value: 1 }),
      meter("obp.api.log.dispatch.entries", "function_counter", { result: "dropped" }, { count: 7 }),
      meter("obp.api.log.dispatch.queue.depth", "gauge", {}, { value: 42 }),
    ];
    expect(summarisePools(meters)).toEqual([
      { pool: "HikariPool-1", active: 3, idle: 0, pending: 1, max: 20, timeouts: 0 },
    ]);
    expect(summariseLogging(meters)).toMatchObject({ queueDepth: 42, dropped: 7, dispatched: 0 });
  });
});

describe("formatting", () => {
  it("formats bytes, shares and durations", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatShare(0.125)).toBe("12.5%");
    expect(formatShare(null)).toBe("—");
    expect(formatDuration(90061)).toBe("1d 1h");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});

describe("metricsSearchHref", () => {
  const now = new Date("2026-09-28T12:30:00Z");

  it("splits the operation id into the version and handler name the API Metrics records store", () => {
    const href = metricsSearchHref("OBPv7.0.0-getBanks", "v7.0.0", now);
    expect(href).not.toBeNull();
    const params = new URL(`http://localhost${href}`).searchParams;
    expect(params.get("implemented_in_version")).toBe("v7.0.0");
    expect(params.get("implemented_by_partial_function")).toBe("getBanks");
    expect(params.get("from_date")).toBe("2026-09-28T11:30");
  });

  it("keeps a handler name that itself contains a dash or underscores", () => {
    const href = metricsSearchHref("OBPv4.0.0-dynamicEntity_getFooBar", "v4.0.0", now);
    expect(new URL(`http://localhost${href}`).searchParams.get("implemented_by_partial_function")).toBe("dynamicEntity_getFooBar");
  });

  it("gives no link when the version is unknown or not in the operation id", () => {
    expect(metricsSearchHref("OBPv7.0.0-getBanks", null, now)).toBeNull();
    expect(metricsSearchHref("OBPv7.0.0-getBanks", "v6.0.0", now)).toBeNull();
  });
});

describe("summariseMemoize", () => {
  it("adds hits and misses per provider and cached method", () => {
    const meters = [
      meter("obp.api.memoize.gets", "counter", { provider: "redis", cache: "Connector.getBanks", result: "hit" }, { count: 30 }),
      meter("obp.api.memoize.gets", "counter", { provider: "redis", cache: "Connector.getBanks", result: "miss" }, { count: 10 }),
      meter("obp.api.memoize.gets", "counter", { provider: "in_memory", cache: "other", result: "miss" }, { count: 2 }),
    ];
    const summary = summariseMemoize(meters);
    expect(summary[0]).toEqual({ provider: "redis", cache: "Connector.getBanks", hits: 30, misses: 10, hitRatio: 0.75 });
    expect(summary[1]).toMatchObject({ provider: "in_memory", cache: "other", hits: 0, misses: 2, hitRatio: 0 });
  });
});

describe("summariseBatchWriters", () => {
  it("reports rows queued, written and lost, the queue depth and failed flushes per writer", () => {
    const meters = [
      meter("obp.api.batch_writer.rows", "counter", { writer: "api_metrics", result: "queued" }, { count: 100 }),
      meter("obp.api.batch_writer.rows", "counter", { writer: "api_metrics", result: "written" }, { count: 90 }),
      meter("obp.api.batch_writer.rows", "counter", { writer: "api_metrics", result: "lost" }, { count: 5 }),
      meter("obp.api.batch_writer.queue.depth", "gauge", { writer: "api_metrics" }, { value: 5 }),
      meter("obp.api.batch_writer.flushes", "timer", { writer: "api_metrics", result: "success" }, { count: 3, total_time: 0.03, max: 0.02 }),
      meter("obp.api.batch_writer.flushes", "timer", { writer: "api_metrics", result: "failure" }, { count: 1, total_time: 0.01, max: 0.01 }),
    ];
    expect(summariseBatchWriters(meters)).toEqual([
      { writer: "api_metrics", queued: 100, written: 90, lost: 5, queueDepth: 5, failedFlushes: 1, meanFlushMillis: 10 },
    ]);
  });
});

describe("summariseResponseShapes", () => {
  it("gives mean and maximum items for list responses, and mean size", () => {
    const meters = [
      meter("obp.api.endpoint.response.items", "distribution_summary", { operation: "OBPv7.0.0-getBanks" }, { count: 4, total: 20, max: 8 }),
      meter("obp.api.endpoint.response.size", "distribution_summary", { operation: "OBPv7.0.0-getBanks" }, { count: 4, total: 4096, max: 2048 }),
      meter("obp.api.endpoint.response.size", "distribution_summary", { operation: "OBPv7.0.0-getBank" }, { count: 2, total: 600, max: 300 }),
    ];
    const shapes = summariseResponseShapes(meters);
    expect(shapes.get("OBPv7.0.0-getBanks")).toEqual({ meanItems: 5, maxItems: 8, meanBytes: 1024 });
    expect(shapes.get("OBPv7.0.0-getBank")).toEqual({ meanItems: null, maxItems: null, meanBytes: 300 });
  });
});

describe("connectorTracesHref", () => {
  it("filters the Connector Traces page by Connector and method from an hour back", () => {
    const href = connectorTracesHref("star", "getBankAccount", new Date("2026-09-28T12:30:00Z"));
    const params = new URL(`http://localhost${href}`).searchParams;
    expect(href?.startsWith("/connector-traces?")).toBe(true);
    expect(params.get("connector_name")).toBe("star");
    expect(params.get("function_name")).toBe("getBankAccount");
    expect(params.get("from_date")).toBe("2026-09-28T11:30");
  });

  it("gives no link for a row that is not a Connector call", () => {
    expect(connectorTracesHref(null, null, new Date())).toBeNull();
  });
});
