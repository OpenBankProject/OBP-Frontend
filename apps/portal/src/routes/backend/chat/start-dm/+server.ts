import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { findOrCreateDm } from "$lib/chat/startDm";
import { obpErrorResponse } from "@obp/shared/obp";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("StartDmAPI");

/**
 * Find or create a 1-on-1 chat room with the given user.
 *
 * Body: { "user_id": "<target user_id>" }
 * Returns: { "chat_room_id": "<id>" }
 *
 * The find-or-create logic lives in $lib/chat/startDm, shared with the
 * /user/chat/dm/[user_id] deep link.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const session = locals.session;
  const accessToken = session?.data?.oauth?.access_token;
  const currentUserId = session?.data?.user?.user_id;

  if (!session?.data?.user || !accessToken || !currentUserId) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  let body: { user_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid JSON body", code: 400 }, { status: 400 });
  }

  const targetUserId = body.user_id;
  if (!targetUserId) {
    return json({ message: "user_id is required", code: 400 }, { status: 400 });
  }

  if (targetUserId === currentUserId) {
    return json(
      { message: "Cannot start a direct message with yourself", code: 400 },
      { status: 400 },
    );
  }

  try {
    const chatRoomId = await findOrCreateDm(accessToken, currentUserId, targetUserId);
    return json({ chat_room_id: chatRoomId });
  } catch (err: unknown) {
    logger.error("Error starting DM:", err);
    const { body: errBody, status } = obpErrorResponse(err);
    return json(errBody, { status });
  }
};
