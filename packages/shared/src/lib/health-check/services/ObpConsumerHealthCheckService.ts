import { createLogger } from "$shared/utils/logger";
import { HealthCheckService, type HealthCheckOptions } from "./HealthCheckService";
import type { OIDCProviderStatus } from "./OIDCHealthCheckService";

const logger = createLogger('ObpConsumerHealthCheckService');

/**
 * Which OBP Consumer this app runs as.
 *
 * The app's OAuth client id is the key of a Consumer in OBP, but a key tells a person
 * nothing. This check mints a client_credentials token for the client and asks OBP
 * `GET /obp/v7.0.0/consumers/current/identity`, which answers with the Consumer's
 * `consumer_id` and `consumer_name` and nothing else (no role needed). The two values
 * are surfaced on the /status page, so "which consumer is the Portal?" is answered
 * there instead of by reading env files. The client id (the Consumer key) is deliberately
 * not shown: it is accepted as a credential by DirectLogin, and the consumer id is the
 * reference the API Manager uses for links.
 *
 * Outcomes:
 *  - healthy:   the client id maps to a Consumer; details carry consumer_id and consumer_name.
 *  - unhealthy: no token could be minted, or OBP answered 401 (the client id is not a
 *               registered Consumer key), or another error.
 *  - unknown:   OBP answered 404: this OBP-API predates the endpoint (v7.0.0, 2026-09).
 */
export interface ObpConsumerHealthCheckOptions extends Omit<HealthCheckOptions, 'url' | 'method' | 'body' | 'expectedStatus'> {
    /** OBP-API base URL, e.g. PUBLIC_OBP_BASE_URL. */
    obpBaseUrl: string;
    /** The OIDC provider that issued the client, read live (same callback the OIDC check uses). */
    providerStatus: () => OIDCProviderStatus | undefined;
    clientId?: string;
    clientSecret?: string;
    /** Tokens are reused until this close to their expiry. Default 60 s. */
    tokenRefreshMarginMs?: number;
    /** Where the consumer can be inspected (the API Manager's consumer page); rendered as a link on /status. */
    consumerUrl?: (consumerId: string) => string;
}

interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

export class ObpConsumerHealthCheckService extends HealthCheckService {
    private readonly obpBaseUrl: string;
    private readonly providerStatus: () => OIDCProviderStatus | undefined;
    private readonly clientId?: string;
    private readonly clientSecret?: string;
    private readonly tokenRefreshMarginMs: number;
    private readonly configuredDetails: Record<string, string | number>;
    private readonly consumerUrl?: (consumerId: string) => string;
    private token: CachedToken | null = null;

    constructor(options: ObpConsumerHealthCheckOptions) {
        super({
            serviceName: options.serviceName,
            url: `${options.obpBaseUrl}/obp/v7.0.0/consumers/current/identity`,
            method: 'GET',
            headers: options.headers,
            timeout: options.timeout ?? 5000,
            interval: options.interval ?? 60000,
            expectedStatus: [200],
            details: options.details
        });
        this.obpBaseUrl = options.obpBaseUrl.replace(/\/$/, '');
        this.providerStatus = options.providerStatus;
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.tokenRefreshMarginMs = options.tokenRefreshMarginMs ?? 60_000;
        this.configuredDetails = options.details ?? {};
        this.consumerUrl = options.consumerUrl;
    }

    async performCheck(): Promise<void> {
        const start = performance.now();
        const timeoutMs = 5000;
        const baseDetails: Record<string, string | number> = { ...this.configuredDetails };

        if (!this.clientId || !this.clientSecret) {
            this.setSnapshot('unknown', start, baseDetails, 'No client credentials configured for this provider');
            return;
        }
        const provider = this.providerStatus();
        if (provider?.status !== 'available' || !provider.url) {
            // The provider's own check already reports why it is down; do not count it twice.
            this.setSnapshot('unknown', start, baseDetails, 'OAuth2 provider not initialized, see its own check');
            return;
        }

        try {
            const accessToken = await this.getAccessToken(provider.url, timeoutMs);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
            let response: Response;
            try {
                response = await fetch(`${this.obpBaseUrl}/obp/v7.0.0/consumers/current/identity`, {
                    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
            }
            const body = await response.json().catch(() => ({})) as { consumer_id?: string; consumer_name?: string; message?: string };

            if (response.status === 200 && body.consumer_id) {
                this.setSnapshot('healthy', start, {
                    ...baseDetails,
                    consumer_id: body.consumer_id,
                    ...(this.consumerUrl ? { consumer_id_url: this.consumerUrl(body.consumer_id) } : {}),
                    consumer_name: body.consumer_name ?? ''
                });
                return;
            }
            if (response.status === 404) {
                this.setSnapshot('unknown', start, baseDetails,
                    'This OBP-API has no GET /obp/v7.0.0/consumers/current/identity yet; the consumer cannot be shown');
                return;
            }
            if (response.status === 401) {
                // A fresh token that OBP does not accept: drop the cache so the next run re-mints.
                this.token = null;
                this.setSnapshot('unhealthy', start, baseDetails,
                    `OBP did not recognise the application: ${body.message ?? '401'}. Is the client id a registered Consumer key?`);
                return;
            }
            this.setSnapshot('unhealthy', start, baseDetails, `OBP answered ${response.status}: ${body.message ?? response.statusText}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(`OBP consumer check failed for ${this.getName()}: ${message}`);
            this.setSnapshot('unhealthy', start, baseDetails, message);
        }
    }

    /** A client_credentials token, reused until shortly before it expires. */
    private async getAccessToken(wellKnownUrl: string, timeoutMs: number): Promise<string> {
        const now = Date.now();
        if (this.token && this.token.expiresAt - this.tokenRefreshMarginMs > now) return this.token.accessToken;

        const discovery = await fetch(wellKnownUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
        if (!discovery.ok) throw new Error(`OIDC discovery failed: ${discovery.status} ${discovery.statusText}`);
        const { token_endpoint } = await discovery.json() as { token_endpoint?: string };
        if (!token_endpoint) throw new Error('OIDC discovery document has no token_endpoint');

        const body = new URLSearchParams();
        body.set('grant_type', 'client_credentials');
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const response = await fetch(token_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                Authorization: `Basic ${credentials}`
            },
            body: body.toString(),
            signal: AbortSignal.timeout(timeoutMs)
        });
        const data = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
        if (!response.ok || !data.access_token) {
            throw new Error(`client_credentials token refused: ${data.error_description ?? data.error ?? `${response.status} ${response.statusText}`}`);
        }
        const ttlMs = (typeof data.expires_in === 'number' ? data.expires_in : 300) * 1000;
        this.token = { accessToken: data.access_token, expiresAt: now + ttlMs };
        return data.access_token;
    }

    private setSnapshot(status: 'healthy' | 'unhealthy' | 'unknown', start: number, details: Record<string, string | number>, error?: string): void {
        this.state.setSnapshot({
            service: this.getName(),
            status,
            responseTimeMs: Math.round(performance.now() - start),
            ...(error ? { error } : {}),
            details
        });
    }
}
