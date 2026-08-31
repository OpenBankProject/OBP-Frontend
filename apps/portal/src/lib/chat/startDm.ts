import { obp_requests } from '$lib/obp/requests';
import { createLogger } from '@obp/shared/utils';

const logger = createLogger('StartDm');

/**
 * Find or create the 1-on-1 chat room between the current user and the target
 * user, returning its chat_room_id. Searches with exact_participants so an
 * existing DM is reused; otherwise creates the room and adds the target.
 * The target may be the current user: exact_participants matches on the set
 * {current user} ∪ with_user_ids, so a self-DM (a private room whose only
 * participant is you — useful for notes-to-self and testing) is found or
 * created the same way; the room creator is already a participant, so no
 * participant is added in that case.
 * Used by the start-dm backend route (in-app "Message" buttons) and the
 * /user/chat/dm/[user_id] deep link (cross-app, e.g. from API Manager).
 */
export async function findOrCreateDm(
	accessToken: string,
	currentUserId: string,
	targetUserId: string
): Promise<string> {
	const searchResponse = await obp_requests.post(
		'/obp/v6.0.0/chat-rooms/search',
		{ with_user_ids: [targetUserId], exact_participants: true },
		accessToken
	);
	const existing = searchResponse.chat_rooms || [];
	if (existing.length > 0) {
		logger.info(`Found existing DM with user ${targetUserId}: ${existing[0].chat_room_id}`);
		return existing[0].chat_room_id;
	}

	const newRoom = await obp_requests.post(
		'/obp/v6.0.0/chat-rooms',
		{
			name: `dm-${currentUserId}-${targetUserId}-${Date.now()}`,
			description: ''
		},
		accessToken
	);
	const newRoomId = newRoom.chat_room_id;
	if (!newRoomId) {
		logger.error('Created chat room had no chat_room_id:', newRoom);
		throw new Error('Failed to create chat room');
	}

	if (targetUserId !== currentUserId) {
		await obp_requests.post(
			`/obp/v6.0.0/chat-rooms/${newRoomId}/participants`,
			{ user_id: targetUserId },
			accessToken
		);
	}

	// Best-effort friendly name. The generated name above exists only to satisfy the
	// per-bank unique-name constraint at creation time; a room named after two UUIDs
	// and a timestamp is disconcerting wherever it is displayed. Once the participants
	// are known, rename to their usernames — and if that name is already taken
	// (usernames are not unique across providers), suffix a slice of the room id.
	// If renaming fails altogether the generated name simply remains.
	try {
		const participantsResponse = await obp_requests.get(
			`/obp/v6.0.0/chat-rooms/${newRoomId}/participants`,
			accessToken
		);
		const usernames = (participantsResponse.participants || [])
			.map((participant: { username?: string }) => participant.username)
			.filter((username: string | undefined): username is string => !!username);
		if (usernames.length > 0) {
			const friendly = usernames.join(' & ');
			try {
				await obp_requests.put(
					`/obp/v6.0.0/chat-rooms/${newRoomId}`,
					{ name: friendly, description: '' },
					accessToken
				);
			} catch {
				await obp_requests
					.put(
						`/obp/v6.0.0/chat-rooms/${newRoomId}`,
						{ name: `${friendly} #${newRoomId.slice(0, 4)}`, description: '' },
						accessToken
					)
					.catch(() => {});
			}
		}
	} catch (e) {
		logger.warn(`Could not give DM ${newRoomId} a friendly name (keeping generated name):`, e);
	}

	logger.info(`Created new DM ${newRoomId} between ${currentUserId} and ${targetUserId}`);
	return newRoomId;
}
