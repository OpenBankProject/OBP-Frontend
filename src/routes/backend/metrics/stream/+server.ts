import type { RequestHandler } from "./$types";
import { streamMetrics, formatMetricEvent, type MetricsStreamFilters } from "$lib/grpc/metricsClient";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("MetricsStreamAPI");

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
  };

  let grpcStream: any;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

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
          const entry = formatMetricEvent(event);
          const data = `data: ${JSON.stringify(entry)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          logger.error(`>>>>> gRPC >>>>> error formatting metric event:`, err);
        }
      });

      grpcStream.on("error", (err: any) => {
        logger.error(`>>>>> gRPC >>>>> metrics STREAM ERROR:`, err.message);
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
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      logger.info(`>>>>> gRPC >>>>> client disconnected, cancelling metrics stream`);
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
