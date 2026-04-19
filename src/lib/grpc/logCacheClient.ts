import { createLogger } from "$lib/utils/logger";
const logger = createLogger("LogCacheGrpcClient");

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(process.cwd(), "proto", "log_cache.proto");
const GRPC_HOST = process.env.OBP_GRPC_HOST || "localhost:50051";
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
      grpc.credentials.createInsecure(),
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
