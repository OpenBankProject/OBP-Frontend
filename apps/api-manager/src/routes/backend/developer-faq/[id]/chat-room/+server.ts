import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env as publicEnv } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { createLogger } from "@obp/shared/utils";
import { FAQ_DATA_PATH, toFaqRecord, toFaqBody } from "$lib/server/developerFaq/faqEntity";

const logger = createLogger("DeveloperFaqChatRoomAPI");

/**
 * POST /backend/developer-faq/ID/chat-room
 * Creates a system chat room named after the question and links it to the FAQ item
 * (chat_room_id + joining key), so the Portal's FAQ shows "Discuss this in the group chat".
 * The caller becomes the room's creator; others join through the joining key.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
  const session = locals.session;
  if (!session?.data?.user) return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) return json({ message: "No API access token available", code: 401 }, { status: 401 });

  try {
    const item = toFaqRecord(await obp_requests.get(`${FAQ_DATA_PATH}/${encodeURIComponent(params.id)}`, token));
    if (item.chat_room_id) return json({ message: "This question already has a chat room", code: 409, item }, { status: 409 });
    const portalUrl = String(publicEnv.PUBLIC_PORTAL_URL ?? "").replace(/\/$/, "");
    const room = await obp_requests.post(
      "/obp/v6.0.0/chat-rooms",
      {
        name: `FAQ: ${item.question}`.slice(0, 200),
        description: `Discussion about the FAQ question "${item.question}".${portalUrl ? ` See ${portalUrl}/faq` : ""}`.slice(0, 1000),
      },
      token,
    );
    const chatRoomId = String(room?.chat_room_id ?? "");
    const joiningKey = String(room?.joining_key ?? "");
    if (!chatRoomId) throw new Error("OBP did not return a chat_room_id");
    const updated = await obp_requests.put(
      `${FAQ_DATA_PATH}/${encodeURIComponent(params.id)}`,
      toFaqBody({ ...item, chat_room_id: chatRoomId, chat_joining_key: joiningKey }),
      token,
    );
    logger.info(`Chat room ${chatRoomId} created for FAQ item ${params.id}`);
    return json({ item: toFaqRecord(updated), chat_room: { chat_room_id: chatRoomId, name: room?.name, joining_key: joiningKey } });
  } catch (e) {
    logger.error(`Failed to create chat room for FAQ item ${params.id}:`, e);
    const { body, status } = obpErrorResponse(e);
    return json(body, { status });
  }
};
