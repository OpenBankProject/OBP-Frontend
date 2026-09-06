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
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("RolesCache");

interface RoleMetadata {
  role: string;
  requires_bank_id: boolean;
}

interface RolesCacheState {
  roles: RoleMetadata[];
  lastFetched: number | null;
  loading: boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class RolesCache {
  private state = $state<RolesCacheState>({
    roles: [],
    lastFetched: null,
    loading: false,
  });

  get roles() {
    return this.state.roles;
  }

  get loading() {
    return this.state.loading;
  }

  private isCacheValid(): boolean {
    if (!this.state.lastFetched) return false;
    return Date.now() - this.state.lastFetched < CACHE_DURATION;
  }

  async fetchRoles(force: boolean = false): Promise<RoleMetadata[]> {
    // Return cached data if valid and not forcing refresh
    if (!force && this.isCacheValid() && this.state.roles.length > 0) {
      logger.info("Returning cached roles");
      return this.state.roles;
    }

    // Don't fetch if already loading
    if (this.state.loading) {
      logger.info("Already loading roles, waiting...");
      // Wait for current fetch to complete
      while (this.state.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.state.roles;
    }

    try {
      this.state.loading = true;
      logger.info("Fetching roles from API");

      const response = await fetch("/proxy/obp/v6.0.0/roles");
      if (!response.ok) {
        throw new Error("Failed to fetch roles metadata");
      }

      const data = await response.json();
      this.state.roles = data.roles || [];
      this.state.lastFetched = Date.now();

      logger.info(`Cached ${this.state.roles.length} roles`);
      return this.state.roles;
    } catch (error) {
      logger.error("Error fetching roles:", error);
      throw error;
    } finally {
      this.state.loading = false;
    }
  }

  getRoleMetadata(roleName: string): RoleMetadata | undefined {
    return this.state.roles.find((r) => r.role === roleName);
  }

  requiresBankId(roleName: string): boolean {
    const role = this.getRoleMetadata(roleName);
    return role?.requires_bank_id ?? false;
  }

  clearCache(): void {
    logger.info("Clearing roles cache");
    this.state.roles = [];
    this.state.lastFetched = null;
  }
}

export const rolesCache = new RolesCache();
