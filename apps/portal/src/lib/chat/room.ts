/**
 * A direct message is just a non-open chat room with exactly two participants.
 * The OBP-API exposes both fields on every chat-room JSON payload, so this
 * predicate works on any room object that came from a chat-rooms endpoint.
 */
export interface ChatRoomDmFields {
	is_open_room: boolean;
	participant_count: number;
}

/** True iff the room is a 1-on-1 direct message. */
export function isDirectMessage(room: ChatRoomDmFields): boolean {
	return !room.is_open_room && room.participant_count === 2;
}

/** Matches the machine names findOrCreateDm generates (dm-<uuid>-<uuid>-<ts>). */
const GENERATED_DM_NAME = /^dm-[0-9a-f-]{36}-[0-9a-f-]{36}-\d+$/i;

/**
 * What to show as a room's name. For a direct message the interesting name is
 * the PERSON, not the room: prefer the other participant's username when the
 * participants are known. Otherwise, a generated machine name (two UUIDs and a
 * timestamp — rooms created before DMs were renamed on creation) collapses to
 * "Direct message" rather than being shown raw. Everything else is the room name.
 */
export function chatRoomDisplayName(
	room: ChatRoomDmFields & { name: string },
	participants?: Array<{ user_id: string; username?: string }>,
	currentUserId?: string
): string {
	if (!isDirectMessage(room)) return room.name;
	const other = participants?.find(
		(participant) => participant.user_id !== currentUserId && participant.username
	);
	if (other?.username) return other.username;
	if (GENERATED_DM_NAME.test(room.name)) return 'Direct message';
	return room.name;
}
