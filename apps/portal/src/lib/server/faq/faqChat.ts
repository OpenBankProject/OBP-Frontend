/**
 * "Start a chat" on a FAQ question: get the question's group chat, creating and linking it on
 * first use. The room is created as the visitor (they become its first participant). Linking
 * it to the public FAQ record needs the Update role on the entity, which the Portal's own
 * consumer holds as a Scope (entity auth_mode UserOrApplication), so that part uses the
 * application token.
 */
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { getApplicationAccessToken } from '$lib/server/oauth/applicationToken';

const logger = createLogger('FaqChat');
const ENTITY = 'obp_developer_faq';

export interface FaqChatOutcome {
	chat_room_id: string;
	joining_key: string;
	created: boolean;
	/** Set when the room exists but could not be recorded on the FAQ item. */
	linkError?: string;
}

async function readItem(id: string): Promise<Record<string, unknown> | null> {
	const response = await obp_requests.get(`/obp/dynamic-entity/public/${ENTITY}/${encodeURIComponent(id)}`).catch(() => null);
	const raw = response?.[ENTITY] ?? response;
	return raw && typeof raw === 'object' && (raw as any).question ? (raw as Record<string, unknown>) : null;
}

/** Marker put in a room's description so the room can be found again even if linking it failed. */
const marker = (id: string) => `[faq:${id}]`;

/** One in-flight get-or-create per question on this server, so two simultaneous clicks share one room. */
const inFlight = new Map<string, Promise<FaqChatOutcome | null>>();

export function getOrCreateFaqChat(id: string, visitorToken: string, portalUrl: string): Promise<FaqChatOutcome | null> {
	const pending = inFlight.get(id);
	if (pending) return pending;
	const task = getOrCreateFaqChatUnlocked(id, visitorToken, portalUrl).finally(() => inFlight.delete(id));
	inFlight.set(id, task);
	return task;
}

/** A room made earlier for this question that never got linked (e.g. the Update scope was missing). */
async function findUnlinkedRoom(id: string, visitorToken: string): Promise<{ chat_room_id: string; joining_key: string } | null> {
	const response = await obp_requests.get('/obp/v6.0.0/chat-rooms', visitorToken).catch(() => null);
	const rooms: any[] = response?.chat_rooms ?? [];
	const found = rooms.find((r) => !r.is_archived && String(r.description ?? '').includes(marker(id)));
	return found ? { chat_room_id: String(found.chat_room_id), joining_key: String(found.joining_key ?? '') } : null;
}

async function getOrCreateFaqChatUnlocked(id: string, visitorToken: string, portalUrl: string): Promise<FaqChatOutcome | null> {
	// Always re-read the record: another visitor, or another Portal instance, may have linked a room meanwhile.
	const item = await readItem(id);
	if (!item) return null;
	const existingRoom = String(item.chat_room_id ?? '').trim();
	if (existingRoom) {
		return { chat_room_id: existingRoom, joining_key: String(item.chat_joining_key ?? '').trim(), created: false };
	}

	const question = String(item.question ?? '');
	let chatRoomId = '';
	let joiningKey = '';
	let created = false;
	const orphan = await findUnlinkedRoom(id, visitorToken);
	if (orphan) {
		({ chat_room_id: chatRoomId, joining_key: joiningKey } = orphan);
		logger.info(`Reusing unlinked room ${chatRoomId} for FAQ item ${id}`);
	} else {
		const room = await obp_requests.post(
			'/obp/v6.0.0/chat-rooms',
			{
				name: `FAQ: ${question}`.slice(0, 200),
				description: `Discussion about the FAQ question "${question}".${portalUrl ? ` See ${portalUrl}/faq` : ''} ${marker(id)}`.slice(0, 1000)
			},
			visitorToken
		);
		chatRoomId = String(room?.chat_room_id ?? '');
		joiningKey = String(room?.joining_key ?? '');
		if (!chatRoomId) throw new Error('OBP did not return a chat_room_id');
		created = true;
	}

	// Link the room to the question with the Portal's application token.
	let linkError: string | undefined;
	const appToken = await getApplicationAccessToken();
	if (!appToken) {
		linkError = 'The Portal has no application token to record the room on the FAQ item.';
	} else {
		const body = {
			question,
			answer: String(item.answer ?? ''),
			opey_prompt: String(item.opey_prompt ?? ''),
			category: String(item.category ?? ''),
			sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
			chat_room_id: chatRoomId,
			chat_joining_key: joiningKey
		};
		try {
			await obp_requests.put(`/obp/dynamic-entity/${ENTITY}/${encodeURIComponent(id)}`, body, appToken);
		} catch (e) {
			linkError = `Room created but not linked to the question: ${e instanceof Error ? e.message : String(e)}. The Portal's consumer needs the Scope CanUpdateDynamicEntity_System${ENTITY}.`;
			logger.warn(linkError);
		}
	}
	return { chat_room_id: chatRoomId, joining_key: joiningKey, created, linkError };
}
