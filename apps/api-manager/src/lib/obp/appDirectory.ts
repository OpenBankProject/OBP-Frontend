import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("AppDirectory");

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: Record<string, string> | null = null;
let cachedAt = 0;

/**
 * The OBP App Directory (anonymous GET /obp/v7.0.0/app-directory): the
 * public_*_url props the API instance advertises for its ecosystem apps.
 * Returns an empty map when unavailable.
 */
export async function getAppDirectory(): Promise<Record<string, string>> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }
  try {
    const response = await obp_requests.get("/obp/v7.0.0/app-directory");
    const entries: Array<{ name: string; value: string }> = response.app_directory || [];
    cached = Object.fromEntries(entries.map((e) => [e.name, e.value]));
    cachedAt = Date.now();
    return cached;
  } catch (error) {
    logger.warn(
      "Could not fetch app-directory:",
      error instanceof Error ? error.message : error,
    );
    return {};
  }
}

/** The Portal's public URL as advertised by the API, or null when not published. */
export async function getPortalUrl(): Promise<string | null> {
  const directory = await getAppDirectory();
  return directory.public_obp_portal_url || null;
}
