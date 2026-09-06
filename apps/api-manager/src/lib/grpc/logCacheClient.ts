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
import { createLogger } from '@obp/shared/utils';
const logger = createLogger("LogCacheGrpcClient");

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { resolveGrpcTarget } from "@obp/shared/obp";
import { grpcChannelCredentials } from "@obp/shared/server/obp";

const PROTO_PATH = path.join(process.cwd(), "proto", "log_cache.proto");
const GRPC_TARGET = resolveGrpcTarget(process.env);
const GRPC_HOST = GRPC_TARGET.host;
const GRPC_AUTH_METADATA_KEY = process.env.OBP_GRPC_AUTH_METADATA_KEY || "authorization";
const GRPC_AUTH_METADATA_VALUE_TEMPLATE =
  process.env.OBP_GRPC_AUTH_METADATA_VALUE_TEMPLATE || "Bearer {token}";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const logCacheProto = (protoDescriptor.code as any).obp.grpc.logcache.g1;

let clientInstance: any = null;

function getClient() {
  if (!clientInstance) {
    logger.info(`>>>>> gRPC >>>>> connecting to log-cache service at ${GRPC_HOST}`);
    clientInstance = new logCacheProto.LogCacheStreamService(
      GRPC_HOST,
      grpcChannelCredentials(GRPC_TARGET),
    );
  }
  return clientInstance;
}

export type LogLevelEnum =
  | "LOG_LEVEL_UNSPECIFIED"
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "ALL";

export interface LogCacheEntryEvent {
  level: string;
  message: string;
  timestamp: string;
  api_instance_id: string;
}

export function streamLogCacheEntries(level: LogLevelEnum, accessToken?: string) {
  const client = getClient();
  const metadata = new grpc.Metadata();
  if (accessToken) {
    const value = GRPC_AUTH_METADATA_VALUE_TEMPLATE.replace("{token}", accessToken);
    metadata.set(GRPC_AUTH_METADATA_KEY, value);
  }
  return client.StreamLogCacheEntries({ level }, metadata);
}

function formatTimestamp(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === "string") return ts;
  const seconds = parseInt(ts.seconds || "0", 10);
  const nanos = ts.nanos || 0;
  return new Date(seconds * 1000 + nanos / 1_000_000).toISOString();
}

export function formatLogCacheEntry(event: any): LogCacheEntryEvent {
  return {
    level: event.level,
    message: event.message || "",
    timestamp: formatTimestamp(event.timestamp),
    api_instance_id: event.api_instance_id || "",
  };
}
