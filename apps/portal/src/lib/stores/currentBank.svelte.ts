import { browser } from "$app/environment";
import { createLogger } from "$lib/utils/logger";
import type { OBPBank } from "$lib/obp/types";

const logger = createLogger("CurrentBank");

const STORAGE_KEY = "currentBank";

class CurrentBankStore {
  bank = $state<OBPBank | null>(null);
  banks = $state<OBPBank[]>([]);
  loading = $state(false);

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
      } catch (e) {
        logger.error("Failed to restore bank from localStorage:", e);
      }
    }
  }

  select(bank: OBPBank | null): void {
    this.bank = bank;
    if (browser) {
      if (bank) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    logger.info(`Selected bank: ${bank?.bank_id ?? "none"}`);
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

  private fetchPromise: Promise<OBPBank[]> | null = null;

  async fetchBanks(): Promise<OBPBank[]> {
    if (this.banks.length > 0) {
      return this.banks;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this._doFetch();
    return this.fetchPromise;
  }

  private async _doFetch(): Promise<OBPBank[]> {
    try {
      this.loading = true;
      const response = await fetch("/api/banks");

      if (!response.ok) {
        throw new Error("Failed to fetch banks");
      }

      const data = await response.json();
      this.banks = (data.banks || [])
        .filter((b: OBPBank) => b.bank_id != null)
        .sort((a: OBPBank, b: OBPBank) => a.bank_id.localeCompare(b.bank_id));

      logger.info(`Fetched ${this.banks.length} banks`);

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

      return this.banks;
    } catch (error) {
      logger.error("Error fetching banks:", error);
      return [];
    } finally {
      this.loading = false;
      this.fetchPromise = null;
    }
  }

  clear(): void {
    this.select(null);
    this.banks = [];
    logger.info("Cleared current bank and bank list");
  }
}

export const currentBank = new CurrentBankStore();
