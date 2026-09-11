import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import { catalogueFromExplorerPathname, collectTags, DEFAULT_EXTERNAL_EXPLORER_URL } from '@obp/shared/explorer';
import {
	fetchApiVersions,
	findVersion,
	getResourceDocIndex,
	groupByStandard,
	latestVersionFor
} from '@obp/shared/server/explorer';
import type { LayoutServerLoad } from './$types';

/**
 * The Explorer shell: the left bar and the version picker, which belong to the whole
 * Explorer rather than to one page.
 *
 * The shell needs to know which catalogue it is showing before any page load has run,
 * and both URL shapes carry that — /obp/v7.0.0 and /endpoint/GET/obp/v7.0.0/banks both
 * name the standard and version — so it is read straight off the pathname.
 */
export const load: LayoutServerLoad = async ({ url }) => {
	const versions = await fetchApiVersions(obp_requests);

	const fromPath = catalogueFromExplorerPathname(url.pathname);
	const current =
		(fromPath && findVersion(versions, fromPath.urlPrefix, fromPath.shortVersion)) ||
		latestVersionFor(versions, 'obp');

	// The root redirect and the legacy redirect both resolve before rendering, so a
	// missing catalogue here means an unknown version; the page's own load raises the 404.
	const index = current ? await getResourceDocIndex(obp_requests, current.fullyQualifiedVersion) : [];

	return {
		current,
		versionGroups: groupByStandard(versions),
		index,
		tags: collectTags(index),
		obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? '',
		opeyBaseUrl: publicEnv.PUBLIC_OPEY_BASE_URL ?? '',
		externalExplorerUrl: String(env.API_EXPLORER_URL || DEFAULT_EXTERNAL_EXPLORER_URL)
	};
};
