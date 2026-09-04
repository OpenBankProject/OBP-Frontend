import { obp_requests } from '$lib/obp/requests';

/** The public system dynamic entity behind the Portal's FAQ. */
export const ENTITY = 'obp_developer_faq';

export interface FaqItem {
	id: string;
	question: string;
	answer: string;
	/** What "Ask Opey" sends; falls back to the question. */
	opey_prompt: string;
	category: string;
	sort_order: number;
	/** A Portal group chat about this question, when the editors linked one. */
	chat_room_id: string;
	/** Its joining key, so a visitor can join from the FAQ. */
	chat_joining_key: string;
}
export interface FaqCategory {
	name: string;
	items: FaqItem[];
}

/** One question by id, from the same public entity (bypasses the list cache). */
export async function loadFaqItem(id: string): Promise<FaqItem | null> {
	const response = await obp_requests.get(`/obp/dynamic-entity/public/${ENTITY}/${encodeURIComponent(id)}`).catch(() => null);
	const r = response?.[ENTITY] ?? response;
	if (!r || typeof r !== 'object' || !r.question) return null;
	return {
		id: String(r[`${ENTITY}_id`] ?? id),
		question: String(r.question ?? '').trim(),
		answer: String(r.answer ?? ''),
		opey_prompt: String(r.opey_prompt ?? '').trim(),
		category: String(r.category ?? '').trim() || 'General',
		sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
		chat_room_id: String(r.chat_room_id ?? '').trim(),
		chat_joining_key: String(r.chat_joining_key ?? '').trim()
	};
}

