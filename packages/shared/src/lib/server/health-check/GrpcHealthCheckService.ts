import { createLogger } from '$shared/utils/logger';
import * as grpc from '@grpc/grpc-js';
import { type HealthCheckOptions, HealthCheckService } from '$shared/health-check/services/HealthCheckService';

const logger = createLogger('GrpcHealthCheckService');

export interface GrpcHealthCheckServiceOptions {
    serviceName: string;
    /** gRPC target as host:port (no scheme), e.g. "localhost:50051". */
    host: string;
    /** Dial with TLS channel credentials — must match how the real clients dial. */
    tls?: boolean;
    timeout?: number;
    interval?: number;
    details?: Record<string, string | number>;
}

const DEFAULT_TIMEOUT_MS = 5000;

export class GrpcHealthCheckService extends HealthCheckService {
    private host: string;
    private tls: boolean;
    private timeoutMs: number;

    constructor(options: GrpcHealthCheckServiceOptions) {
        // The fetch-based url is unused, but HealthCheckService requires it
        super({
            url: '',
            serviceName: options.serviceName,
            ...(options.interval !== undefined ? { interval: options.interval } : {}),
            ...(options.details ? { details: options.details } : {})
        } as HealthCheckOptions);
        this.host = options.host;
        this.tls = options.tls ?? false;
        this.timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    }

    /**
     * Probe the gRPC endpoint by opening a channel and waiting for it to become
     * READY. A bare grpc.Client needs no proto definition: waitForReady performs
     * the TCP + HTTP/2 handshake, which is exactly what "the gRPC service is up
     * and accepting connections" means. No RPC is invoked, so no auth is needed.
     */
    async performCheck(): Promise<void> {
        const startTime = performance.now();
        const client = new grpc.Client(
            this.host,
            this.tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
        );

        try {
            await new Promise<void>((resolve, reject) => {
                client.waitForReady(Date.now() + this.timeoutMs, (error) =>
                    error ? reject(error) : resolve()
                );
            });

            const responseTimeMs = Math.round(performance.now() - startTime);
            this.state.setSnapshot({
                status: 'healthy',
                responseTimeMs
            });
            logger.debug(
                `gRPC health check for ${this.getName()} (${this.host}) succeeded in ${responseTimeMs} ms`
            );
        } catch (error) {
            const responseTimeMs = Math.round(performance.now() - startTime);
            this.state.setSnapshot({
                status: 'unhealthy',
                responseTimeMs,
                error: error instanceof Error ? error.message : String(error)
            });
            logger.error(`gRPC health check for ${this.getName()} (${this.host}) failed:`, error);
        } finally {
            client.close();
        }
    }
}
