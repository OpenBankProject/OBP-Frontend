import type { RequestHandler } from "./$types";
import { streamMetrics, formatMetricEvent, type MetricsStreamFilters } from "$lib/grpc/metricsClient";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { redisService } from "$lib/redis/services/RedisService";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("MetricsStreamAPI");

// The gRPC stream is authenticated ONCE at open. Without a live check, a stream opened
// before logout keeps delivering privileged data while the UI says logged out —
// technically sound, corrosive to user trust. So the session is re-checked on this
// cadence and the stream is ended explicitly the moment it is gone.
const SESSION_RECHECK_MS = 30_000;
// Must match the RedisStore prefix configured in hooks.server.ts.
const SESSION_KEY_PREFIX = "obp-api-manager-ii-session:";

export const GET: RequestHandler = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    return new Response(JSON.stringify({ message: "Unauthorized", code: 401 }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;
  if (!accessToken) {
    return new Response(
      JSON.stringify({ message: "No API access token available", code: 401 }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const filters: MetricsStreamFilters = {
    consumer_id: url.searchParams.get("consumer_id") ?? "",
    user_id: url.searchParams.get("user_id") ?? "",
    verb: url.searchParams.get("verb") ?? "",
    url_substring: url.searchParams.get("url_substring") ?? url.searchParams.get("url") ?? "",
    implemented_by_partial_function:
      url.searchParams.get("implemented_by_partial_function") ?? "",
    app_name: url.searchParams.get("app_name") ?? "",
    consent_reference_id: url.searchParams.get("consent_reference_id") ?? "",
  };

  const sessionId = session.id;

  let grpcStream: any;
  let sessionCheckTimer: ReturnType<typeof setInterval> | null = null;

  function stopSessionCheck() {
    if (sessionCheckTimer) {
      clearInterval(sessionCheckTimer);
      sessionCheckTimer = null;
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      sessionCheckTimer = setInterval(async () => {
        try {
          const alive = await redisService
            .getClient()
            .exists(`${SESSION_KEY_PREFIX}${sessionId}`);
          if (!alive) {
            logger.info(`>>>>> gRPC >>>>> session ${sessionId} ended — closing metrics stream`);
            stopSessionCheck();
            try {
              const data = `event: session-ended\ndata: ${JSON.stringify({
                reason: "Your session has ended. Please log in again.",
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
              controller.close();
            } catch {
              // Controller may already be closed
            }
            if (grpcStream) {
              grpcStream.cancel();
            }
          }
        } catch (err) {
          // A Redis hiccup must not kill a healthy stream — the next tick re-checks.
          logger.warn(`>>>>> gRPC >>>>> session re-check failed (will retry):`, err);
        }
      }, SESSION_RECHECK_MS);

      logger.info(`>>>>> gRPC >>>>> opening metrics stream`);
      controller.enqueue(encoder.encode(":ok\n\n"));

      try {
        grpcStream = streamMetrics(filters, accessToken);
      } catch (err: any) {
        logger.error(`>>>>> gRPC >>>>> FAILED to open metrics stream:`, err);
        try {
          const reason = err?.message || "Failed to open gRPC stream";
          const data = `event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // ignore
        }
        controller.close();
        return;
      }

      grpcStream.on("data", (event: any) => {
        try {
          logger.info(
            `>>>>> gRPC >>>>> metric raw event keys=${Object.keys(event).join(",")} operation_id=${event.operation_id} duration=${event.duration} status_code=${event.status_code}`,
          );
          const entry = formatMetricEvent(event);
          const data = `data: ${JSON.stringify(entry)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          logger.error(`>>>>> gRPC >>>>> error formatting metric event:`, err);
        }
      });

      grpcStream.on("error", (err: any) => {
        logger.error(`>>>>> gRPC >>>>> metrics STREAM ERROR:`, err.message);
        stopSessionCheck();
        try {
          const reason =
            err?.code !== undefined
              ? `${err.message} (code ${err.code})`
              : err?.message || "gRPC stream error";
          const data = `event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`;
          controller.enqueue(encoder.encode(data));
          controller.close();
        } catch {
          // Controller may already be closed
        }
      });

      grpcStream.on("end", () => {
        logger.info(`>>>>> gRPC >>>>> metrics stream ended`);
        stopSessionCheck();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      logger.info(`>>>>> gRPC >>>>> client disconnected, cancelling metrics stream`);
      stopSessionCheck();
      if (grpcStream) {
        grpcStream.cancel();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
