import type { PageServerLoad } from './$types';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { ENTITY, type FaqItem, type FaqCategory } from '$lib/server/faq/faqItems';
export type { FaqItem, FaqCategory };

const logger = createLogger('FaqPage');
const CACHE_TTL_MS = 60_000;

let cache: { at: number; categories: FaqCategory[] } | null = null;

/**
 * The FAQ lives in the public system dynamic entity `obp_developer_faq`, so it is read
 * anonymously (no token) and edited in the API Manager's dynamic entity pages.
 */
async function loadCategories(): Promise<FaqCategory[]> {
	if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.categories;
	const response = await obp_requests.get(`/obp/dynamic-entity/public/${ENTITY}`);
	const listKey = Object.keys(response ?? {}).find((k) => Array.isArray(response[k]));
	const records: any[] = listKey ? response[listKey] : [];
	const items: FaqItem[] = records
		.map((r) => ({
			id: String(r[`${ENTITY}_id`] ?? ''),
			question: String(r.question ?? '').trim(),
			answer: String(r.answer ?? ''),
			opey_prompt: String(r.opey_prompt ?? '').trim(),
			category: String(r.category ?? '').trim() || 'General',
			sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
			chat_room_id: String(r.chat_room_id ?? '').trim(),
			chat_joining_key: String(r.chat_joining_key ?? '').trim()
		}))
		.filter((i) => i.question && i.answer);
	const byCategory = new Map<string, FaqItem[]>();
	for (const item of items) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
	const categories = [...byCategory.entries()]
		.map(([name, list]) => ({ name, items: list.sort((a, b) => a.sort_order - b.sort_order || a.question.localeCompare(b.question)) }))
		.sort((a, b) => Math.min(...a.items.map((i) => i.sort_order)) - Math.min(...b.items.map((i) => i.sort_order)) || a.name.localeCompare(b.name));
	cache = { at: Date.now(), categories };
	return categories;
}

export const load: PageServerLoad = async () => {
	try {
		return { categories: await loadCategories(), unavailable: '' };
	} catch (e) {
		logger.error('FAQ unavailable:', e);
		return { categories: [] as FaqCategory[], unavailable: e instanceof Error ? e.message : 'The FAQ is not available right now.' };
	}
};
