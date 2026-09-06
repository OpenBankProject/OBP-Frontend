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
import { createLogger } from "$shared/utils/logger";
import { HealthCheckService, type HealthCheckOptions } from "./HealthCheckService";

const logger = createLogger('OIDCHealthCheckService');

/**
 * Live status of a provider as tracked by an OAuth2 provider manager.
 * `status: 'unavailable'` means the app could not initialize an OAuth client
 * for it (missing credentials, unreachable endpoint, no strategy, ...) — the
 * provider cannot be used for login even if its well-known URL is reachable.
 */
export interface OIDCProviderStatus {
    status: 'available' | 'unavailable';
    url?: string;
    error?: string;
}

export interface OIDCHealthCheckOptions extends Omit<HealthCheckOptions, 'url' | 'method' | 'body' | 'expectedStatus'> {
    wellKnownUrl?: string;
    /**
     * Called at the start of every check. When it reports the provider as
     * unavailable, the check goes unhealthy with the initialization error and
     * skips the network probes — a reachable discovery endpoint is meaningless
     * if the app holds no usable client for it. When available, the reported
     * url takes precedence over wellKnownUrl, so providers discovered after
     * startup are probed at their live address.
     */
    providerStatus?: () => OIDCProviderStatus | undefined;
    clientId?: string;
    clientSecret?: string;
    /**
     * When true, a failed client_credentials test flips the service unhealthy.
     * When false (default), the test result is surfaced in details but does
     * not affect the overall status — useful when the client may be
     * authorization_code-only and would otherwise trip a permanent alarm.
     */
    strictClientCredentials?: boolean;
    /** Optional scope for the client_credentials test. */
    clientCredentialsScope?: string;
    /**
     * How often to actually run the client_credentials probe. The discovery +
     * JWKS checks still run at the base interval; the token test runs at most
     * this often. Default: 1 hour.
     */
    clientCredentialsIntervalMs?: number;
    /**
     * OBP-API base URL. When set, a successful client_credentials token is used once to ask
     * GET /obp/v7.0.0/consumers/current/identity which OBP Consumer this client is; the answer
     * (consumer_id, consumer_name) is added to the details. The client id itself is never shown:
     * it is the Consumer key, a credential. Skipped when unset.
     */
    obpBaseUrl?: string;
    /** Where the consumer can be inspected (the API Manager's consumer page); rendered as a link on /status. */
    consumerUrl?: (consumerId: string) => string;
}

interface DiscoveryDoc {
    issuer?: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    jwks_uri?: string;
    grant_types_supported?: string[];
}

interface Jwk {
    kty?: string;
    kid?: string;
    use?: string;
    alg?: string;
}

interface Jwks {
    keys?: Jwk[];
}

interface TokenTestOutcome {
    ok: boolean;
    message: string;
    responseTimeMs: number;
    ranAt: number;
    /** The issued token, kept in memory only, so the consumer identity can be read with it. */
    accessToken?: string;
    /** Which OBP Consumer the client is, read once per token. */
    consumer?: ConsumerIdentity;
}

/** The calling Consumer as OBP reports it: id and name only. */
interface ConsumerIdentity {
    consumer_id?: string;
    consumer_name?: string;
    /** Set when the OBP-API has no identity endpoint yet, or refused the token. */
    note?: string;
}

export class OIDCHealthCheckService extends HealthCheckService {
    private readonly wellKnownUrl?: string;
    private readonly providerStatus?: () => OIDCProviderStatus | undefined;
    private readonly clientId?: string;
    private readonly clientSecret?: string;
    private readonly strictClientCredentials: boolean;
    private readonly clientCredentialsScope?: string;
    private readonly clientCredentialsIntervalMs: number;
    private readonly obpBaseUrl?: string;
    private readonly consumerUrl?: (consumerId: string) => string;
    private lastTokenTest: TokenTestOutcome | null = null;

    constructor(options: OIDCHealthCheckOptions) {
        if (!options.wellKnownUrl && !options.providerStatus) {
            throw new Error(`OIDCHealthCheckService for ${options.serviceName} needs wellKnownUrl or providerStatus`);
        }
        super({
            serviceName: options.serviceName,
            url: options.wellKnownUrl ?? '',
            method: 'GET',
            headers: options.headers,
            timeout: options.timeout ?? 5000,
            interval: options.interval ?? 60000,
            expectedStatus: [200]
        });
        this.wellKnownUrl = options.wellKnownUrl;
        this.providerStatus = options.providerStatus;
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.strictClientCredentials = options.strictClientCredentials ?? false;
        this.clientCredentialsScope = options.clientCredentialsScope;
        this.clientCredentialsIntervalMs = options.clientCredentialsIntervalMs ?? 60 * 60 * 1000;
        this.obpBaseUrl = options.obpBaseUrl?.replace(/\/$/, '');
        this.consumerUrl = options.consumerUrl;
    }

    async performCheck(): Promise<void> {
        const startTime = performance.now();
        const timeoutMs = 5000;

        const provider = this.providerStatus?.();
        const wellKnownUrl = provider?.url ?? this.wellKnownUrl;

        if (this.providerStatus && provider?.status !== 'available') {
            this.setUnhealthy(
                provider?.error ?? 'Provider not initialized',
                performance.now() - startTime,
                {
                    provider_state: 'not initialized — login with this provider is unavailable',
                    ...(wellKnownUrl ? { wellKnownUrl } : {})
                }
            );
            return;
        }

        if (!wellKnownUrl) {
            this.setUnhealthy(
                'No well-known URL known for this provider',
                performance.now() - startTime,
                {}
            );
            return;
        }

        try {
            const discovery = await this.fetchJson<DiscoveryDoc>(wellKnownUrl, timeoutMs);

            const missing: string[] = [];
            if (!discovery.authorization_endpoint) missing.push('authorization_endpoint');
            if (!discovery.token_endpoint) missing.push('token_endpoint');
            if (!discovery.jwks_uri) missing.push('jwks_uri');

            if (missing.length > 0) {
                const elapsed = performance.now() - startTime;
                this.setUnhealthy(
                    `Discovery doc missing required fields: ${missing.join(', ')}`,
                    elapsed,
                    { wellKnownUrl }
                );
                return;
            }

            const jwks = await this.fetchJson<Jwks>(discovery.jwks_uri!, timeoutMs);
            const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
            const signingKeys = keys.filter(k => k.kty && (k.use === 'sig' || k.use === undefined));

            const details: Record<string, string | number> = {
                issuer: discovery.issuer ?? '(not advertised)',
                jwks_uri: discovery.jwks_uri!,
                keys: keys.length,
                signing_keys: signingKeys.length
            };

            if (signingKeys.length === 0) {
                const elapsed = performance.now() - startTime;
                this.setUnhealthy(
                    `JWKS at ${discovery.jwks_uri} has no usable signing keys`,
                    elapsed,
                    details
                );
                return;
            }

            let tokenTestFailed = false;
            if (this.clientId && this.clientSecret) {
                const now = Date.now();
                const due = this.lastTokenTest === null
                    || (now - this.lastTokenTest.ranAt) >= this.clientCredentialsIntervalMs;

                if (due) {
                    this.lastTokenTest = await this.performClientCredentialsTest(
                        discovery.token_endpoint!,
                        timeoutMs
                    );
                }

                const outcome = this.lastTokenTest!;
                details.token_test = outcome.ok ? 'ok' : 'failed';
                details.token_test_ms = outcome.responseTimeMs;
                details.token_test_age = formatAge(Date.now() - outcome.ranAt);
                if (!outcome.ok) {
                    details.token_test_error = outcome.message;
                    tokenTestFailed = true;
                }
                if (outcome.consumer?.consumer_id) {
                    details.consumer_id = outcome.consumer.consumer_id;
                    if (this.consumerUrl) details.consumer_id_url = this.consumerUrl(outcome.consumer.consumer_id);
                    details.consumer_name = outcome.consumer.consumer_name ?? '';
                } else if (outcome.consumer?.note) {
                    details.consumer = outcome.consumer.note;
                }
            } else {
                details.token_test = 'skipped (no credentials configured)';
            }

            const elapsed = performance.now() - startTime;

            if (tokenTestFailed && this.strictClientCredentials) {
                this.setUnhealthy(
                    `client_credentials test failed: ${details.token_test_error}`,
                    elapsed,
                    details
                );
                return;
            }

            logger.debug(`OIDC check healthy for ${this.getName()} in ${elapsed.toFixed(0)}ms (${signingKeys.length} signing keys${tokenTestFailed ? ', token_test failed (non-strict)' : ''})`);
            this.state.setSnapshot({
                service: this.getName(),
                status: 'healthy',
                responseTimeMs: Math.round(elapsed),
                details
            });
        } catch (err) {
            const elapsed = performance.now() - startTime;
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(`OIDC check failed for ${this.getName()}: ${message}`);
            this.setUnhealthy(message, elapsed, { wellKnownUrl });
        }
    }

    private async performClientCredentialsTest(
        tokenEndpoint: string,
        timeoutMs: number
    ): Promise<TokenTestOutcome> {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);

        const body = new URLSearchParams();
        body.set('grant_type', 'client_credentials');
        if (this.clientCredentialsScope) {
            body.set('scope', this.clientCredentialsScope);
        }

        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${credentials}`
                },
                body: body.toString(),
                signal: controller.signal
            });
            const elapsed = performance.now() - start;
            const ranAt = Date.now();

            if (response.ok) {
                let accessToken: string | undefined;
                try {
                    accessToken = ((await response.json()) as { access_token?: string }).access_token;
                } catch {
                    // Token body not JSON: the test still passed, only the identity lookup is skipped
                }
                const outcome: TokenTestOutcome = { ok: true, message: 'token issued', responseTimeMs: Math.round(elapsed), ranAt, accessToken };
                if (accessToken && this.obpBaseUrl) {
                    outcome.consumer = await this.readConsumerIdentity(accessToken, timeoutMs);
                }
                return outcome;
            }

            let errDesc = `${response.status} ${response.statusText}`;
            try {
                const data = await response.json() as { error?: string; error_description?: string };
                if (data?.error) {
                    errDesc = data.error_description ? `${data.error}: ${data.error_description}` : data.error;
                }
            } catch {
                // Response body wasn't JSON, keep status line
            }
            return { ok: false, message: errDesc, responseTimeMs: Math.round(elapsed), ranAt };
        } catch (err) {
            const elapsed = performance.now() - start;
            const message = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(err);
            return { ok: false, message, responseTimeMs: Math.round(elapsed), ranAt: Date.now() };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Which OBP Consumer the token belongs to. GET /obp/v7.0.0/consumers/current/identity needs no
     * role and returns only consumer_id and consumer_name.
     */
    private async readConsumerIdentity(accessToken: string, timeoutMs: number): Promise<ConsumerIdentity> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
        try {
            const response = await fetch(`${this.obpBaseUrl}/obp/v7.0.0/consumers/current/identity`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
                signal: controller.signal
            });
            const body = (await response.json().catch(() => ({}))) as { consumer_id?: string; consumer_name?: string; message?: string };
            if (response.ok && body.consumer_id) {
                return { consumer_id: body.consumer_id, consumer_name: body.consumer_name ?? '' };
            }
            if (response.status === 404) {
                return { note: 'not available: this OBP-API has no GET /obp/v7.0.0/consumers/current/identity' };
            }
            return { note: `OBP did not identify the application (${response.status}): ${body.message ?? response.statusText}` };
        } catch (err) {
            return { note: err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(err) };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`${url} returned ${response.status} ${response.statusText}`);
            }
            return (await response.json()) as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private setUnhealthy(error: string, elapsedMs: number, details: Record<string, string | number>): void {
        this.state.setSnapshot({
            service: this.getName(),
            status: 'unhealthy',
            responseTimeMs: Math.round(elapsedMs),
            error,
            details
        });
    }
}

function formatAge(ageMs: number): string {
    if (ageMs < 60_000) return 'just now';
    const minutes = Math.floor(ageMs / 60_000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
}
