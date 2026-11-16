import { DASHBOARD_ROLES, loadDashboard, mayReadDashboard } from '$lib/server/dashboard';
import { messageOf } from '$lib/server/errors';
import { userToken } from '$lib/server/records';
import { centralSpace } from '$lib/server/space';
import type { PageServerLoad } from './$types';

/** The dashboard, counted only for a User who holds its Roles; the page shows the shared role widget otherwise. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const required = DASHBOARD_ROLES.map((role) => ({ role, bankId: centralSpace() }));
	if (!(await mayReadDashboard(token))) return { dashboard: null, problem: null, required };
	try {
		return { dashboard: await loadDashboard(token), problem: null, required };
	} catch (err) {
		return { dashboard: null, problem: messageOf(err), required };
	}
};
