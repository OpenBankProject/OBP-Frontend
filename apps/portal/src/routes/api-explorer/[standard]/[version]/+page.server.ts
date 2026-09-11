import { error } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { fetchApiVersions, findVersion } from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * A catalogue with no endpoint chosen. The endpoint list itself lives in the shell's
 * left bar, so this page is the overview that the middle pane shows until something is
 * selected.
 */
export const load: PageServerLoad = async ({ params }) => {
	const versions = await fetchApiVersions(obp_requests);
	const current = findVersion(versions, params.standard, params.version);
	if (!current) {
		error(404, `No API version ${params.standard}/${params.version}`);
	}
	return { current };
};
