/**
 * The landing-page fetchers for this app: the shared implementation, bound to this app's OBP client.
 */
import { obp_requests } from "$lib/obp/requests";
import { buildLandingFetchers as buildShared, findDemoCollectionId as findShared, type LandingLinkConfig } from "@obp/shared/server/landing";
import type { LandingFetchers } from "@obp/shared/landing";

export type { LandingLinkConfig };

export function buildLandingFetchers(token: string, links: LandingLinkConfig): LandingFetchers {
  return buildShared((path, t) => obp_requests.get(path, t), token, links);
}

export async function findDemoCollectionId(token: string): Promise<string> {
  return findShared((path, t) => obp_requests.get(path, t), token);
}
