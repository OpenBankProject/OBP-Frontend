import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The /aggregate-metrics route was renamed to /aggregate-metrics-live to disambiguate
// from the new /aggregate-metrics-trends page. Preserve any in-flight bookmarks/links.
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(308, `/aggregate-metrics-live${url.search}`);
};
