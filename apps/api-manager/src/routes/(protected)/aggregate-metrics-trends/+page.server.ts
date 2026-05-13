import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	if (!session?.data?.user) {
		throw error(401, 'Unauthorized');
	}
	return {};
};
