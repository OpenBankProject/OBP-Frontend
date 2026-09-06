import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";
import { env } from "$env/dynamic/private";

const logger = createLogger("GlossaryCache");

/** One item of GET /obp/v4.0.0/api/glossary. */
export interface GlossaryItem {
  title: string;
  description: { markdown: string; html: string };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes: the glossary only changes on an OBP-API deploy
const GLOSSARY_PATH = "/obp/v4.0.0/api/glossary";
const DEFAULT_EXPLORER_URL = "https://apiexplorer-ii-sandbox.openbankproject.com";

let items: GlossaryItem[] = [];
let lastFetched: number | null = null;
let inFlight: Promise<GlossaryItem[]> | null = null;

/**
 * The OBP glossary, fetched once and shared by every request for 30 minutes.
 * The glossary is the single source of unstructured documentation text: pages render
 * its entries instead of carrying their own prose.
 */
export async function fetchGlossary(accessToken: string, force = false): Promise<GlossaryItem[]> {
  const fresh = lastFetched !== null && Date.now() - lastFetched < CACHE_DURATION;
  if (!force && fresh && items.length > 0) return items;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const resp = await obp_requests.get(GLOSSARY_PATH, accessToken);
      items = (resp?.glossary_items ?? []) as GlossaryItem[];
      lastFetched = Date.now();
      logger.info(`Cached ${items.length} glossary items from OBP`);
      return items;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Case-insensitive lookup by title; undefined when this OBP instance has no such entry. */
export function findGlossaryItem(all: GlossaryItem[], title: string): GlossaryItem | undefined {
  const t = title.toLowerCase();
  return all.find((i) => i.title.toLowerCase() === t);
}

/** The API Explorer base URL, as the layout computes it, with any query string removed. */
export function apiExplorerBaseUrl(): string {
  return String(env.API_EXPLORER_URL || DEFAULT_EXPLORER_URL)
    .replace(/\/$/, "")
    .replace(/\/?\?.*$/, "");
}

/**
 * Glossary markdown links to other entries are site-relative to the API Explorer
 * (`[here](/glossary#Title)`). Point them at the Explorer so they work from the Manager.
 */
export function rewriteGlossaryLinks(markdown: string, explorerUrl = apiExplorerBaseUrl()): string {
  return markdown.replace(/\]\(\/glossary#/g, `](${explorerUrl}/glossary#`);
}

/** The API Explorer page for one glossary entry. */
export function glossaryEntryUrl(title: string, explorerUrl = apiExplorerBaseUrl()): string {
  return `${explorerUrl}/glossary#${encodeURIComponent(title)}`;
}
