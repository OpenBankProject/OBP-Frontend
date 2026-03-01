import { browser } from "$app/environment";
import { createLogger } from "$lib/utils/logger";
import { trackedFetch } from "$lib/utils/trackedFetch";

const logger = createLogger("UserPreferences");

const STORAGE_KEY = "userPreferences";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type Theme = "dark" | "light";

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2025)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2025)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2025-12-31)" },
];

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

interface PersonalDataField {
  user_attribute_id: string;
  name: string;
  type: string;
  value: string;
  is_personal: boolean;
  insert_date?: string;
}

interface StoredPreferences {
  dateFormat: DateFormat;
  theme: Theme;
  dateFormatAttributeId?: string;
  themeAttributeId?: string;
}

const FIELD_DATE_FORMAT = "DATE_FORMAT";
const FIELD_THEME = "THEME";

class UserPreferencesStore {
  dateFormat = $state<DateFormat>("DD/MM/YYYY");
  theme = $state<Theme>("dark");
  loading = $state(false);
  private dateFormatAttributeId: string | null = null;
  private themeAttributeId: string | null = null;
  private initialized = false;

  constructor() {
    if (browser) {
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: StoredPreferences = JSON.parse(stored);
        this.dateFormat = prefs.dateFormat || "DD/MM/YYYY";
        this.theme = prefs.theme || "dark";
        this.dateFormatAttributeId = prefs.dateFormatAttributeId || null;
        this.themeAttributeId = prefs.themeAttributeId || null;
        logger.info(`Restored preferences from localStorage: dateFormat=${this.dateFormat}, theme=${this.theme}`);
      } else {
        // Fall back to the legacy theme storage
        const legacyTheme = localStorage.getItem("mode");
        if (legacyTheme === "light" || legacyTheme === "dark") {
          this.theme = legacyTheme;
          logger.info(`Restored theme from legacy localStorage: ${this.theme}`);
        }
      }
    } catch (e) {
      logger.error("Failed to restore preferences from localStorage:", e);
    }
  }

  private saveToLocalStorage() {
    if (!browser) return;
    try {
      const prefs: StoredPreferences = {
        dateFormat: this.dateFormat,
        theme: this.theme,
        dateFormatAttributeId: this.dateFormatAttributeId || undefined,
        themeAttributeId: this.themeAttributeId || undefined,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      // Keep legacy theme key in sync for LightSwitch compatibility
      localStorage.setItem("mode", this.theme);
    } catch (e) {
      logger.error("Failed to save preferences to localStorage:", e);
    }
  }

  /** Load preferences from OBP personal data fields */
  async loadFromOBP() {
    if (!browser) return;
    this.loading = true;
    try {
      const res = await trackedFetch("/api/user/preferences");
      if (!res.ok) {
        logger.warn("Failed to load preferences from OBP:", res.status);
        return;
      }
      const data = await res.json();
      const attributes: PersonalDataField[] = data.user_attributes || [];

      for (const attr of attributes) {
        if (attr.name === FIELD_DATE_FORMAT) {
          this.dateFormat = (attr.value as DateFormat) || "DD/MM/YYYY";
          this.dateFormatAttributeId = attr.user_attribute_id;
        } else if (attr.name === FIELD_THEME) {
          this.theme = (attr.value as Theme) || "dark";
          this.themeAttributeId = attr.user_attribute_id;
          // Apply theme immediately
          document.documentElement.setAttribute("data-mode", this.theme);
        }
      }

      this.saveToLocalStorage();
      this.initialized = true;
      logger.info(`Loaded preferences from OBP: dateFormat=${this.dateFormat}, theme=${this.theme}`);
    } catch (e) {
      logger.error("Error loading preferences from OBP:", e);
    } finally {
      this.loading = false;
    }
  }

  /** Save a single preference to OBP (create or update) */
  private async saveToOBP(name: string, value: string, attributeId: string | null): Promise<string | null> {
    if (!browser) return null;
    try {
      if (attributeId) {
        // Update existing
        const res = await trackedFetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_attribute_id: attributeId,
            name,
            value,
            type: "STRING",
          }),
        });
        if (!res.ok) {
          logger.error(`Failed to update preference ${name}:`, res.status);
          return attributeId;
        }
        const data = await res.json();
        return data.user_attribute_id || attributeId;
      } else {
        // Create new
        const res = await trackedFetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            value,
            type: "STRING",
          }),
        });
        if (!res.ok) {
          logger.error(`Failed to create preference ${name}:`, res.status);
          return null;
        }
        const data = await res.json();
        return data.user_attribute_id || null;
      }
    } catch (e) {
      logger.error(`Error saving preference ${name} to OBP:`, e);
      return attributeId;
    }
  }

  async setDateFormat(format: DateFormat) {
    this.dateFormat = format;
    this.saveToLocalStorage();
    this.dateFormatAttributeId = await this.saveToOBP(FIELD_DATE_FORMAT, format, this.dateFormatAttributeId);
    this.saveToLocalStorage();
  }

  async setTheme(theme: Theme) {
    this.theme = theme;
    // Apply theme immediately
    if (browser) {
      document.documentElement.setAttribute("data-mode", theme);
    }
    this.saveToLocalStorage();
    this.themeAttributeId = await this.saveToOBP(FIELD_THEME, theme, this.themeAttributeId);
    this.saveToLocalStorage();
  }

  /** Format a date string according to the user's preferred date format */
  formatDate(dateString: string | undefined | null): string {
    if (!dateString) return "\u2014";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "\u2014";

      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      switch (this.dateFormat) {
        case "DD/MM/YYYY":
          return `${day}/${month}/${year}`;
        case "MM/DD/YYYY":
          return `${month}/${day}/${year}`;
        case "YYYY-MM-DD":
          return `${year}-${month}-${day}`;
        default:
          return `${day}/${month}/${year}`;
      }
    } catch {
      return "\u2014";
    }
  }

  clear() {
    this.dateFormat = "DD/MM/YYYY";
    this.theme = "dark";
    this.dateFormatAttributeId = null;
    this.themeAttributeId = null;
    this.initialized = false;
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
    logger.info("Cleared user preferences");
  }
}

export const userPreferences = new UserPreferencesStore();
