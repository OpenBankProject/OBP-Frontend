import { createLogger } from "$lib/utils/logger";
const logger = createLogger("MetricsGrpcClient");

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(process.cwd(), "proto", "metrics_stream.proto");
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
const metricsProto = (protoDescriptor.code as any).obp.grpc.metricsstream.g1;

let clientInstance: any = null;

function getClient() {
  if (!clientInstance) {
    logger.info(`>>>>> gRPC >>>>> connecting to metrics service at ${GRPC_HOST}`);
    clientInstance = new metricsProto.MetricsStreamService(
      GRPC_HOST,
      grpc.credentials.createInsecure(),
    );
  }
  return clientInstance;
}

// Shape mirrors REST /obp/v6.0.0/management/metrics response. The gRPC proto
// now uses REST-aligned field names directly (username, duration, status_code,
// operation_id, api_instance_id), so there's no field renaming to do.
export interface MetricEventShape {
  url: string;
  date: string;
  duration: number;
  user_id: string;
  username: string;
  app_name: string;
  developer_email: string;
  consumer_id: string;
  implemented_by_partial_function: string;
  implemented_in_version: string;
  verb: string;
  status_code: number;
  correlation_id: string;
  source_ip: string;
  target_ip: string;
  api_instance_id: string;
  operation_id: string;
}

export interface MetricsStreamFilters {
  consumer_id?: string;
  user_id?: string;
  verb?: string;
  url_substring?: string;
  implemented_by_partial_function?: string;
  app_name?: string;
}

export function streamMetrics(filters: MetricsStreamFilters, accessToken?: string) {
  const client = getClient();
  const metadata = new grpc.Metadata();
  if (accessToken) {
    const value = GRPC_AUTH_METADATA_VALUE_TEMPLATE.replace("{token}", accessToken);
    metadata.set(GRPC_AUTH_METADATA_KEY, value);
  }
  // Pass only non-empty filter values; others default to "" server-side.
  const request: MetricsStreamFilters = {
    consumer_id: filters.consumer_id || "",
    user_id: filters.user_id || "",
    verb: filters.verb || "",
    url_substring: filters.url_substring || "",
    implemented_by_partial_function: filters.implemented_by_partial_function || "",
    app_name: filters.app_name || "",
  };
  return client.StreamMetrics(request, metadata);
}

export function formatMetricEvent(event: any): MetricEventShape {
  return {
    url: event.url,
    date: event.date,
    duration: parseInt(event.duration || "0", 10),
    user_id: event.user_id,
    username: event.username,
    app_name: event.app_name,
    developer_email: event.developer_email,
    consumer_id: event.consumer_id,
    implemented_by_partial_function: event.implemented_by_partial_function,
    implemented_in_version: event.implemented_in_version,
    verb: event.verb,
    status_code: event.status_code || 0,
    correlation_id: event.correlation_id,
    source_ip: event.source_ip,
    target_ip: event.target_ip,
    api_instance_id: event.api_instance_id,
    operation_id: event.operation_id,
  };
}
