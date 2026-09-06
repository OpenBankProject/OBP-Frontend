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
import { browser } from "$app/environment";
import { createLogger } from "@obp/shared/utils";
import { trackedFetch } from "$lib/utils/trackedFetch";

const logger = createLogger("CurrentBank");

const STORAGE_KEY = "currentBank";
// Banks change rarely; refresh the cached list at most this often. A stale picker
// open still shows the cached list instantly and refreshes in the background.
const BANKS_TTL_MS = 5 * 60 * 1000;
const ATTR_ID_STORAGE_KEY = "currentBankAttributeId";
const OBP_FIELD_NAME = "CURRENT_BANK_ID";

export interface Bank {
  bank_id: string;
  bank_code?: string;
  short_name?: string;
  full_name?: string;
  logo?: string;
  website?: string;
  bank_routings?: { scheme: string; address: string }[];
  attributes?: { name: string; value: string }[];
}

class CurrentBankStore {
  bank = $state<Bank | null>(null);
  banks = $state<Bank[]>([]);
  loading = $state(false);
  justChanged = $state(false);
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  private attributeId: string | null = null;
  private suppressRemoteWrite = false;

  get bankId(): string {
    return this.bank?.bank_id ?? "";
  }

  constructor() {
    if (browser) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.bank = JSON.parse(stored);
          logger.info(`Restored bank from localStorage: ${this.bank?.bank_id}`);
        }
        this.attributeId = localStorage.getItem(ATTR_ID_STORAGE_KEY);
      } catch (e) {
        logger.error("Failed to restore bank from localStorage:", e);
      }
    }
  }

  select(bank: Bank | null): void {
    const prevBankId = this.bank?.bank_id ?? null;
    const nextBankId = bank?.bank_id ?? null;
    this.bank = bank;
    if (browser) {
      if (bank) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    logger.info(`Selected bank: ${nextBankId ?? "none"}`);

    // Trigger the highlight animation
    if (bank && browser) {
      if (this.changeTimer) clearTimeout(this.changeTimer);
      this.justChanged = true;
      this.changeTimer = setTimeout(() => {
        this.justChanged = false;
      }, 1500);
    }

    if (browser && !this.suppressRemoteWrite && prevBankId !== nextBankId) {
      void this.saveToOBP(nextBankId);
    }
  }

  selectById(bankId: string): void {
    if (!bankId) {
      this.select(null);
      return;
    }
    const bank = this.banks.find((b) => b.bank_id === bankId);
    if (bank) {
      this.select(bank);
    } else {
      logger.warn(`Bank not found: ${bankId}`);
    }
  }

  private fetchPromise: Promise<Bank[]> | null = null;
  private banksFetchedAt = 0;

  async fetchBanks(): Promise<Bank[]> {
    if (this.banks.length > 0) {
      // Stale-while-revalidate: serve the cached list immediately; when it is
      // older than the TTL, refresh in the background (_doFetch clears
      // fetchPromise in its finally, so this re-arms after each refresh).
      if (Date.now() - this.banksFetchedAt > BANKS_TTL_MS && !this.fetchPromise) {
        this.fetchPromise = this._doFetch();
      }
      return this.banks;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this._doFetch();
    return this.fetchPromise;
  }

  private async _doFetch(): Promise<Bank[]> {
    try {
      this.loading = true;
      const response = await trackedFetch("/proxy/obp/v6.0.0/banks");

      if (!response.ok) {
        throw new Error("Failed to fetch banks");
      }

      const data = await response.json();
      this.banks = (data.banks || [])
        .filter((b: Bank) => b.bank_id != null)
        .sort((a: Bank, b: Bank) => a.bank_id.localeCompare(b.bank_id));

      logger.info(`Fetched ${this.banks.length} banks`);
      this.banksFetchedAt = Date.now();

      // Refresh stored bank with full data from API
      if (this.bank) {
        const freshBank = this.banks.find(
          (b) => b.bank_id === this.bank!.bank_id,
        );
        if (freshBank) {
          this.select(freshBank);
        } else {
          logger.warn(
            `Stored bank ${this.bank.bank_id} no longer exists, clearing`,
          );
          this.select(null);
        }
      }

      // Auto-select first bank if none is set
      if (!this.bank && this.banks.length > 0) {
        logger.info(`No bank selected, defaulting to first: ${this.banks[0].bank_id}`);
        this.select(this.banks[0]);
      }

      return this.banks;
    } catch (error) {
      logger.error("Error fetching banks:", error);
      return [];
    } finally {
      this.loading = false;
      this.fetchPromise = null;
    }
  }

  async loadFromOBP(): Promise<void> {
    if (!browser) return;
    try {
      const res = await trackedFetch("/backend/user/preferences");
      if (!res.ok) {
        logger.warn("Failed to load current bank from OBP:", res.status);
        return;
      }
      const data = await res.json();
      const attrs: { user_attribute_id: string; name: string; value: string }[] =
        data.user_attributes || [];
      const attr = attrs.find((a) => a.name === OBP_FIELD_NAME);

      this.suppressRemoteWrite = true;
      try {
        if (attr) {
          this.attributeId = attr.user_attribute_id;
          localStorage.setItem(ATTR_ID_STORAGE_KEY, this.attributeId);
          const remoteBankId = attr.value;
          if (remoteBankId && remoteBankId !== this.bank?.bank_id) {
            const found = this.banks.find((b) => b.bank_id === remoteBankId);
            this.select(found ?? { bank_id: remoteBankId });
          }
          logger.info(`Loaded current bank from OBP: ${remoteBankId}`);
        } else if (this.bank) {
          // No remote value but we have a local pick — seed remote.
          this.suppressRemoteWrite = false;
          await this.saveToOBP(this.bank.bank_id);
        }
      } finally {
        this.suppressRemoteWrite = false;
      }
    } catch (e) {
      logger.error("Error loading current bank from OBP:", e);
    }
  }

  private async saveToOBP(bankId: string | null): Promise<void> {
    if (!browser) return;
    try {
      if (this.attributeId) {
        const res = await trackedFetch("/backend/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_attribute_id: this.attributeId,
            name: OBP_FIELD_NAME,
            value: bankId ?? "",
            type: "STRING",
          }),
        });
        if (!res.ok) {
          logger.error(`Failed to update ${OBP_FIELD_NAME}:`, res.status);
        }
      } else if (bankId) {
        const res = await trackedFetch("/backend/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: OBP_FIELD_NAME,
            value: bankId,
            type: "STRING",
          }),
        });
        if (!res.ok) {
          logger.error(`Failed to create ${OBP_FIELD_NAME}:`, res.status);
          return;
        }
        const data = await res.json();
        const newId = data.user_attribute_id;
        if (newId) {
          this.attributeId = newId;
          localStorage.setItem(ATTR_ID_STORAGE_KEY, newId);
        }
      }
    } catch (e) {
      logger.error(`Error saving ${OBP_FIELD_NAME} to OBP:`, e);
    }
  }

  clear(): void {
    this.select(null);
    this.banks = [];
    this.attributeId = null;
    if (browser) {
      localStorage.removeItem(ATTR_ID_STORAGE_KEY);
    }
    logger.info("Cleared current bank and bank list");
  }
}

export const currentBank = new CurrentBankStore();
