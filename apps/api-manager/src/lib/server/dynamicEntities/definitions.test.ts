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

const { findDynamicEntityDefinition } = await import("./definitions");

const activity = { dynamic_entity_id: "de-1", entity_name: "activity" };
const country = { dynamic_entity_id: "de-2", entity_name: "country" };

describe("findDynamicEntityDefinition", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ dynamic_entities: [activity, country] });
  });

  it("finds a definition by its dynamic_entity_id", async () => {
    expect(await findDynamicEntityDefinition("de-2", "ogcr", "token")).toBe(country);
  });

  it("finds a definition by its entity name, for links built from the public resource docs", async () => {
    expect(await findDynamicEntityDefinition("activity", "ogcr", "token")).toBe(activity);
  });

  it("prefers the id when a name happens to equal another entity's id", async () => {
    get.mockResolvedValue({
      dynamic_entities: [{ dynamic_entity_id: "x", entity_name: "de-1" }, activity],
    });
    expect(await findDynamicEntityDefinition("de-1", "ogcr", "token")).toBe(activity);
  });

  it("is null when nothing matches", async () => {
    expect(await findDynamicEntityDefinition("parcel", "ogcr", "token")).toBeNull();
  });
});
