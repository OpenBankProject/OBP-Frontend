/**
 * The live-catalogue fetchers behind the landing page blocks (see
 * @obp/shared/landing). Used by the blocks demo page and the App Studio
 * expand route. Everything goes through OBP with the current user's token.
 */
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import type { LandingFetchers, LandingProduct, LandingEndpoint, LandingBank } from "@obp/shared/landing";

const logger = createLogger("LandingFetchers");
const API_VERSION = "v6.0.0";

// Resource docs are large and change rarely: one copy per process, refreshed every 10 minutes.
let resourceDocsCache: { at: number; byOperationId: Map<string, any> } | null = null;
async function getResourceDocs(token: string): Promise<Map<string, any>> {
  if (resourceDocsCache && Date.now() - resourceDocsCache.at < 10 * 60 * 1000) return resourceDocsCache.byOperationId;
  const response = await obp_requests.get(`/obp/${API_VERSION}/resource-docs/${API_VERSION}/obp`, token);
  const byOperationId = new Map<string, any>();
  for (const doc of response?.resource_docs ?? []) byOperationId.set(doc.operation_id, doc);
  resourceDocsCache = { at: Date.now(), byOperationId };
  return byOperationId;
}

function mapProduct(raw: any): LandingProduct {
  const amount = raw.monthly_subscription_amount ? parseFloat(raw.monthly_subscription_amount) : undefined;
  return {
    bank_id: raw.bank_id,
    api_product_code: raw.api_product_code,
    name: raw.name,
    description: raw.description || undefined,
    category: raw.category || undefined,
    price_monthly: Number.isFinite(amount) ? amount : undefined,
    price_currency: raw.monthly_subscription_currency || undefined,
  };
}

export interface LandingLinkConfig {
  /** Portal base URL, no trailing slash. */
  portalUrl: string;
  /** API Explorer base URL, no trailing slash; empty for no endpoint links. */
  explorerUrl: string;
}

export function buildLandingFetchers(token: string, links: LandingLinkConfig): LandingFetchers {
  let productsPromise: Promise<any[]> | null = null;
  const allProducts = () =>
    (productsPromise ??= obp_requests.get(`/obp/${API_VERSION}/api-products`, token).then((r) => r?.api_products ?? []));

  return {
    products: async ({ tag, bank, limit }) => {
      let products: any[] = await allProducts();
      if (tag) products = products.filter((p) => (p.tags ?? []).map((t: string) => t.toLowerCase()).includes(tag.toLowerCase()));
      if (bank) products = products.filter((p) => p.bank_id === bank);
      return products.slice(0, limit).map(mapProduct);
    },
    endpoints: async ({ collection, limit }) => {
      const response = await obp_requests.get(`/obp/${API_VERSION}/api-collections/${encodeURIComponent(collection)}/api-collection-endpoints`, token);
      const operationIds: string[] = (response?.api_collection_endpoints ?? []).map((e: any) => e.operation_id).slice(0, limit);
      const docs = await getResourceDocs(token).catch((e) => {
        logger.warn("Resource docs unavailable, endpoints shown without summaries:", e);
        return new Map<string, any>();
      });
      return operationIds.map((operation_id): LandingEndpoint => {
        const doc = docs.get(operation_id);
        return { operation_id, request_verb: doc?.request_verb, request_url: doc?.request_url, summary: doc?.summary };
      });
    },
    banks: async ({ limit }) => {
      const response = await obp_requests.get(`/obp/${API_VERSION}/banks`, token);
      return (response?.banks ?? []).slice(0, limit).map((b: any): LandingBank => ({
        id: b.bank_id,
        full_name: b.full_name,
        logo: b.logo || undefined,
        website: b.website || undefined,
      }));
    },
    stat: async (kind) => {
      switch (kind) {
        case "endpoint-count":
          return (await getResourceDocs(token)).size;
        case "product-count":
          return (await allProducts()).length;
        case "bank-count":
          return ((await obp_requests.get(`/obp/${API_VERSION}/banks`, token))?.banks ?? []).length;
        default:
          throw new Error(`Unknown stat kind "${kind}"`);
      }
    },
    links: {
      product: (p) => `${links.portalUrl}/products/${encodeURIComponent(p.api_product_code)}`,
      endpoint: (e) =>
        links.explorerUrl ? `${links.explorerUrl}/resource-docs/${API_VERSION}?operationid=${encodeURIComponent(e.operation_id)}` : undefined,
      signup: `${links.portalUrl}/register`,
    },
  };
}

/** The first catalogue product's collection id, for examples that need one. */
export async function findDemoCollectionId(token: string): Promise<string> {
  const raw: any[] = (await obp_requests.get(`/obp/${API_VERSION}/api-products`, token))?.api_products ?? [];
  return raw.find((p) => p.collection_id)?.collection_id ?? "";
}
