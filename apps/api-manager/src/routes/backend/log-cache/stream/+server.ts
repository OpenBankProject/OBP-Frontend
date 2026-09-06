/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import type { RequestHandler } from "./$types";
import { streamLogCacheEntries, formatLogCacheEntry, type LogLevelEnum } from "$lib/grpc/logCacheClient";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("LogCacheStreamAPI");

const VALID_LEVELS: LogLevelEnum[] = [
  "LOG_LEVEL_UNSPECIFIED",
  "TRACE",
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "ALL",
];

function normalizeLevel(raw: string | null): LogLevelEnum {
  if (!raw) return "ALL";
  const upper = raw.toUpperCase();
  if (upper === "WARN") return "WARNING";
  if ((VALID_LEVELS as string[]).includes(upper)) return upper as LogLevelEnum;
  return "ALL";
}

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

  const level = normalizeLevel(url.searchParams.get("level"));
  let grpcStream: any;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      logger.info(`>>>>> gRPC >>>>> opening log-cache stream (level=${level})`);

      // Kick-start SSE so EventSource fires `onopen` before first gRPC event.
      controller.enqueue(encoder.encode(":ok\n\n"));

      try {
        grpcStream = streamLogCacheEntries(level, accessToken);
      } catch (err: any) {
        logger.error(`>>>>> gRPC >>>>> FAILED to open log-cache stream:`, err);
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
          const entry = formatLogCacheEntry(event);
          const data = `data: ${JSON.stringify(entry)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          logger.error(`>>>>> gRPC >>>>> error formatting log entry:`, err);
        }
      });

      grpcStream.on("error", (err: any) => {
        logger.error(`>>>>> gRPC >>>>> log-cache STREAM ERROR:`, err.message);
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
        logger.info(`>>>>> gRPC >>>>> log-cache stream ended`);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      logger.info(`>>>>> gRPC >>>>> client disconnected, cancelling log-cache stream`);
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
