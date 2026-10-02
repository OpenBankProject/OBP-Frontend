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

const clearManager = vi.fn();
const clearShared = vi.fn();
vi.mock("$lib/server/glossaryCache", () => ({ clearGlossaryCache: () => clearManager() }));
vi.mock("@obp/shared/server/explorer", () => ({ clearGlossaryCache: () => clearShared() }));

import { clearCachesAfterWrite } from "./clearCachesAfterWrite";

describe("clearCachesAfterWrite", () => {
  beforeEach(() => {
    clearManager.mockClear();
    clearShared.mockClear();
  });

  it.each([
    ["POST", "v7.0.0/api/glossary"],
    ["PUT", "v7.0.0/api/glossary/Bank%20Account"],
    ["DELETE", "obp/v7.0.0/api/glossary/Bank"],
  ])("clears both glossary caches after a successful %s %s", (method, path) => {
    clearCachesAfterWrite(method, path, true);
    expect(clearManager).toHaveBeenCalledOnce();
    expect(clearShared).toHaveBeenCalledOnce();
  });

  it("clears nothing on a read, a failed write or another path", () => {
    clearCachesAfterWrite("GET", "v7.0.0/api/glossary", true);
    clearCachesAfterWrite("POST", "v7.0.0/api/glossary", false);
    clearCachesAfterWrite("POST", "v7.0.0/banks/gh.29.uk/accounts", true);
    clearCachesAfterWrite("PUT", "v7.0.0/api/glossaryx", true);
    expect(clearManager).not.toHaveBeenCalled();
    expect(clearShared).not.toHaveBeenCalled();
  });
});
