import { createLogger } from "$lib/utils/logger";
import { HealthCheckState, type HealthCheckSnapshot } from "../state/HealthCheckState";

const logger = createLogger('HealthCheckService');

export interface HealthCheckOptions {
    url: string; // URL of health check endpoint
    method?: 'GET' | 'POST' | 'HEAD';
    headers?: Record<string, string>;
    timeout?: number;
    interval?: number; // Time in ms between checks
    expectedStatus?: number[]; // Expected HTTP status code for a healthy response
    body?: any; // Optional body for POST requests
    serviceName: string; // Name of the service being checked
}

export class HealthCheckService {
    protected state: HealthCheckState;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private abortController: AbortController | null = null;
    private options: HealthCheckOptions;

    constructor(options: HealthCheckOptions) {
        this.options = {
            method: 'GET',
            headers: {},
            timeout: 5000,
            interval: 60000, // Default: check every 60 seconds
            expectedStatus: [200, 201, 204],
            body: '',
            ...options
        };

        // Initialize state
        this.state = new HealthCheckState();
        this.state.setSnapshot({
            service: this.options.serviceName,
            status: 'unknown',
        })

        logger.info(`HealthCheckService for ${this.options.serviceName} initialized. First check in ${this.options.interval} ms`);
    }

    subscribe(callback: (snapshot: HealthCheckSnapshot) => void): void {
        this.state.subscribe(callback);
    }

    /**
     *  
    * Start periodic health checks
    */
    start(): void {
        if (this.checkInterval) {
            logger.warn(`HealthCheckService for ${this.options.serviceName} is already running.`);
            return;
        }

        // Perform an immediate check, then start interval
        this.performCheck();

        this.checkInterval = setInterval(() => {
            this.performCheck()
        }, this.options.interval);
    }

    /**
     * Stop periodic health checks and abort any ongoing check
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info(`HealthCheckService for ${this.options.serviceName} stopped.`);
        }

        // Abort any ongoing request
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }


    /**
     * Perform a single health check
     */
    async performCheck(): Promise<void> {
        const startTime = performance.now();

        // Create an abort controller for the check request
        this.abortController = new AbortController();

        try {
            const timeoutId = setTimeout(() => {
                if (this.abortController) {
                    this.abortController.abort('timeout');
                }
            }, this.options.timeout);

            const response = await fetch(this.options.url, {
                method: this.options.method,
                headers: this.options.headers,
                body: this.options.method !== 'GET' && this.options.method !== 'HEAD' ? this.options.body : undefined,
                signal: this.abortController.signal,
            });

            clearTimeout(timeoutId);

            const responseTimeMs = performance.now() - startTime;

            const isHealthy = this.options.expectedStatus?.includes(response.status);

            if (isHealthy) {
                logger.debug(`HealthCheckService for ${this.options.serviceName} succeeded with status ${response.status} in ${responseTimeMs.toFixed(2)} ms`);
                this.state.setSnapshot({
                    service: this.options.serviceName,
                    status: 'healthy',
                    responseTimeMs: Math.round(responseTimeMs),
                });
            } else {
                logger.warn(`HealthCheckService for ${this.options.serviceName} returned unexpected status ${response.status} in ${responseTimeMs.toFixed(2)} ms`);
                this.state.setSnapshot({
                    service: this.options.serviceName,
                    status: 'unhealthy',
                    responseTimeMs: Math.round(responseTimeMs),
                    error: `Unexpected status code: ${response.status}`
                });
            }
        } catch (error) {
            const responseTimeMs = performance.now() - startTime;

            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.name === 'AbortError' ? 'Request timeout' : error.message;
            }

            logger.error(`HealthCheckService for ${this.options.serviceName} failed: ${errorMessage} after ${responseTimeMs.toFixed(2)} ms`);
            this.state.setSnapshot({
                service: this.options.serviceName,
                status: 'unhealthy',
                responseTimeMs: Math.round(responseTimeMs),
                error: errorMessage
            });
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Get the current health check snapshot
     */
    getSnapshot(): HealthCheckSnapshot {
        return { ...this.state['snapshot'] };
    }

    getName(): string {
        return this.options.serviceName;
    }

    /**
     * Check if the health check is currently running
     */
    isHealthCheckRunning(): boolean {
        return this.checkInterval !== null;
    }

}