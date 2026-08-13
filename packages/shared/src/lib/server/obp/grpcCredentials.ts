import * as grpc from '@grpc/grpc-js';
import type { GrpcTarget } from '$shared/obp/grpcHost';

/** Channel credentials matching a resolved gRPC target's TLS setting. */
export function grpcChannelCredentials(target: GrpcTarget): grpc.ChannelCredentials {
	return target.tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
}
