import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("ResourceDocsCache");

export interface ResourceDoc {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
  description?: string;
  markdown_description?: string;
  description_html?: string;
  roles?: Array<{ role: string; requires_bank_id: boolean }>;
  tags?: string[];
  specified_url?: string;
  example_request_body?: unknown;
  success_response_body?: unknown;
}

interface CacheState {
  docs: ResourceDoc[];
  lastFetched: number | null;
  loading: boolean;
  loadingPromise: Promise<ResourceDoc[]> | null;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (resource docs change rarely)

/**
 * Server-side cache for OBP resource docs
 * This is a singleton that persists in memory across requests
 */
class ResourceDocsCache {
  private cache: CacheState = {
    docs: [],
    lastFetched: null,
    loading: false,
    loadingPromise: null,
  };

  get docs(): ResourceDoc[] {
    return this.cache.docs;
  }

  get loading(): boolean {
    return this.cache.loading;
  }

  private isCacheValid(): boolean {
    if (!this.cache.lastFetched) return false;
    return Date.now() - this.cache.lastFetched < CACHE_DURATION;
  }

  /**
   * Fetch resource docs directly from OBP
   */
  private async fetchResourceDocsFromOBP(
    accessToken: string,
  ): Promise<ResourceDoc[]> {
    logger.info("Fetching resource docs directly from OBP...");

    const endpoint = `/obp/v6.0.0/resource-docs/v6.0.0/obp`;
    const response = await obp_requests.get(endpoint, accessToken);

    const docs = response.resource_docs || [];
    this.cache.docs = docs;
    this.cache.lastFetched = Date.now();

    logger.info(`Cached ${docs.length} resource docs from OBP`);
    return docs;
  }

  /**
   * Fetch resource docs (tries cache first, then fetches if needed)
   */
  async fetchResourceDocs(
    accessToken: string,
    force: boolean = false,
  ): Promise<ResourceDoc[]> {
    // Return cached data if valid and not forcing refresh
    if (!force && this.isCacheValid() && this.cache.docs.length > 0) {
      logger.info(
        `Returning cached resource docs (${this.cache.docs.length} docs, age: ${Math.round((Date.now() - (this.cache.lastFetched || 0)) / 1000)}s)`,
      );
      return this.cache.docs;
    }

    // If already loading, wait for the existing fetch to complete
    if (this.cache.loading && this.cache.loadingPromise) {
      logger.info("Fetch already in progress, waiting for completion...");
      return this.cache.loadingPromise;
    }

    // Start new fetch
    this.cache.loading = true;

    try {
      // Create and store the promise so other concurrent requests can await it
      this.cache.loadingPromise = this.fetchResourceDocsFromOBP(accessToken);
      const docs = await this.cache.loadingPromise;
      return docs;
    } catch (error) {
      logger.error("Error fetching resource docs:", error);
      // Clear cache on error
      this.cache.docs = [];
      this.cache.lastFetched = null;
      throw error;
    } finally {
      this.cache.loading = false;
      this.cache.loadingPromise = null;
    }
  }

  /**
   * Get resource docs for a specific role
   */
  getDocsForRole(roleName: string): ResourceDoc[] {
    return this.cache.docs.filter((doc) => {
      const roles = doc.roles || [];
      return roles.some((r) => r.role === roleName);
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    logger.info("Clearing resource docs cache");
    this.cache.docs = [];
    this.cache.lastFetched = null;
    this.cache.loading = false;
    this.cache.loadingPromise = null;
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    const age = this.cache.lastFetched
      ? Math.round((Date.now() - this.cache.lastFetched) / 1000)
      : null;

    return {
      count: this.cache.docs.length,
      lastFetched: this.cache.lastFetched,
      ageSeconds: age,
      isValid: this.isCacheValid(),
      loading: this.cache.loading,
    };
  }

  /**
   * Pre-warm the cache in the background without blocking
   * This is useful to populate the cache when the user first logs in
   */
  async preWarmCache(accessToken: string): Promise<void> {
    // Don't pre-warm if cache is already valid
    if (this.isCacheValid() && this.cache.docs.length > 0) {
      logger.debug(
        `Cache already valid (${this.cache.docs.length} docs), skipping pre-warm`,
      );
      return;
    }

    // Don't pre-warm if already loading
    if (this.cache.loading) {
      logger.debug("Cache fetch already in progress, skipping pre-warm");
      return;
    }

    try {
      logger.info("Pre-warming resource docs cache in background...");
      // Start fetch without awaiting - this runs in background
      this.fetchResourceDocs(accessToken).catch((error) => {
        logger.error("Background cache pre-warm failed:", error);
      });
    } catch (error) {
      // Silently fail - pre-warming is best-effort
      logger.warn("Failed to start cache pre-warm:", error);
    }
  }
}

// Export singleton instance
export const resourceDocsCache = new ResourceDocsCache();
