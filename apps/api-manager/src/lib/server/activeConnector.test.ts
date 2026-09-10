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
import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.fn();
vi.mock("$lib/obp/requests", () => ({ obp_requests: { get: (...args: unknown[]) => get(...args) } }));

const { loadActiveConnector, STAR_FALLBACK_CONNECTOR } = await import("./activeConnector");

/** config-props carries (name, value) pairs; method_routings carries connector_name. */
function respond(props: { name: string; value: string }[], routings?: { connector_name: string }[]) {
  get.mockImplementation(async (path: string) => {
    if (path.includes("config-props")) return { config_props: props };
    if (path.includes("method_routings")) {
      if (!routings) throw new Error("OBP-20006: User is missing one or more roles: CanGetMethodRoutings");
      return { method_routings: routings };
    }
    throw new Error(`unexpected path ${path}`);
  });
}

beforeEach(() => {
  get.mockReset();
});

describe("loadActiveConnector", () => {
  it("reports a single connector when the prop names one", async () => {
    respond([{ name: "connector", value: "rest_vMar2019" }]);
    const active = await loadActiveConnector("token", true);
    expect(active).toMatchObject({ prop: "rest_vMar2019", isStar: false, effective: ["rest_vMar2019"] });
    expect(active.warnings).toEqual([]);
    // No point reading the routings when one connector answers everything.
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("reads the prop by `name`, not `key`", async () => {
    respond([{ name: "connector", value: "grpc_vFeb2026" }]);
    expect((await loadActiveConnector("token", true)).prop).toBe("grpc_vFeb2026");
  });

  it("resolves star to the routed connectors plus the mapped fallback", async () => {
    respond(
      [{ name: "connector", value: "star" }],
      [
        { connector_name: "rest_vMar2019" },
        { connector_name: "grpc_vFeb2026" },
        { connector_name: "rest_vMar2019" },
      ],
    );
    const active = await loadActiveConnector("token", true);
    expect(active.isStar).toBe(true);
    // Most-routed first, so the connector doing the most work reads first.
    expect(active.delegates).toEqual([
      { name: "rest_vMar2019", routings: 2 },
      { name: "grpc_vFeb2026", routings: 1 },
    ]);
    expect(active.effective).toEqual(["rest_vMar2019", "grpc_vFeb2026", STAR_FALLBACK_CONNECTOR]);
    expect(active.warnings).toEqual([]);
  });

  it("says star falls back to mapped alone when nothing is routed", async () => {
    respond([{ name: "connector", value: "star" }], []);
    const active = await loadActiveConnector("token", true);
    expect(active.delegates).toEqual([]);
    expect(active.effective).toEqual([STAR_FALLBACK_CONNECTOR]);
  });

  it("still reports star when the routings need a role the user lacks", async () => {
    respond([{ name: "connector", value: "star" }]);
    const active = await loadActiveConnector("token", true);
    expect(active.isStar).toBe(true);
    expect(active.delegates).toEqual([]);
    expect(active.warnings.join(" ")).toContain("CanGetMethodRoutings");
  });

  it("degrades to unknown rather than throwing when config-props fails", async () => {
    get.mockRejectedValue(new Error("OBP-20001: User not logged in"));
    const active = await loadActiveConnector("token", true);
    expect(active).toMatchObject({ prop: null, isStar: false, effective: [] });
    expect(active.warnings.join(" ")).toContain("connector");
  });

  it("treats a masked value as unknown", async () => {
    respond([{ name: "connector", value: "****" }]);
    const active = await loadActiveConnector("token", true);
    expect(active.prop).toBeNull();
    expect(active.warnings.join(" ")).toContain("did not report");
  });
});
