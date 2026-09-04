import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadFaqItem } from '$lib/server/faq/faqItems';

export const load: PageServerLoad = async ({ params }) => {
	const item = await loadFaqItem(params.id);
	if (!item) error(404, { message: 'No such FAQ question.' });
	return { item };
};
