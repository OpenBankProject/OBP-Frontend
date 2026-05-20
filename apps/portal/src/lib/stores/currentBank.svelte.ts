import { browser } from "$app/environment";
import { createLogger } from "@obp/shared/utils";
import type { OBPBank } from "$lib/obp/types";

const logger = createLogger("CurrentBank");

const STORAGE_KEY = "currentBank";
const ATTR_ID_STORAGE_KEY = "currentBankAttributeId";
const OBP_FIELD_NAME = "CURRENT_BANK_ID";

class CurrentBankStore {
  bank = $state<OBPBank | null>(null);
  banks = $state<OBPBank[]>([]);
  loading = $state(false);
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

  select(bank: OBPBank | null): void {
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
      const response = await fetch("/backend/banks");

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

  async loadFromOBP(): Promise<void> {
    if (!browser) return;
    try {
      const res = await fetch("/proxy/obp/v6.0.0/my/personal-data-fields");
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
            this.select(found ?? ({ bank_id: remoteBankId } as OBPBank));
          }
          logger.info(`Loaded current bank from OBP: ${remoteBankId}`);
        } else if (this.bank) {
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
        const res = await fetch(
          `/proxy/obp/v6.0.0/my/personal-data-fields/${encodeURIComponent(this.attributeId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: OBP_FIELD_NAME,
              value: bankId ?? "",
              type: "STRING",
            }),
          },
        );
        if (!res.ok) {
          logger.error(`Failed to update ${OBP_FIELD_NAME}:`, res.status);
        }
      } else if (bankId) {
        const res = await fetch("/proxy/obp/v6.0.0/my/personal-data-fields", {
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
