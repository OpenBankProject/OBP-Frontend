import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * /user/activity was renamed to /user/my-activity-dashboard (2026-08-31), to stop
 * it being confused with the API Manager's system-activity-dashboard. Permanent
 * redirect keeps old bookmarks and links working, filters included.
 */
export const load: PageServerLoad = async ({ url }) => {
	redirect(301, `/user/my-activity-dashboard${url.search}`);
};
