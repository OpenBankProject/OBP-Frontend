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
import { HealthCheckService } from "./HealthCheckService";
import type { HealthCheckSnapshot } from "../state/HealthCheckState";
import {
    compareConsumerScopes,
    type ConsumerApp,
    type ConsumerScopesReport,
    type HeldScope,
    type RequiredConsumerScope
} from "$shared/obp/requiredConsumerScopes";

const logger = createLogger('ConsumerScopesHealthCheckService');

export const CURRENT_CONSUMER_SCOPES_PATH = '/obp/v7.0.0/consumers/current/scopes';

/** An application token, or why there is none (the shape of requestApplicationAccessToken's result). */
export type ApplicationTokenSource = () => Promise<{ token: string } | { token: null; reason: string }>;

export interface ConsumerScopesHealthCheckOptions {
    serviceName: string;
    app: ConsumerApp;
    required: RequiredConsumerScope[];
    obpBaseUrl: string;
    getApplicationToken: ApplicationTokenSource;
    /** Link for the consumer_id on /status, e.g. its page on the API Manager. */
    consumerUrl?: (consumerId: string) => string;
    interval?: number;
    timeout?: number;
}

/** The answer of GET /obp/v7.0.0/consumers/current/scopes, as far as it matters here. */
export interface CurrentConsumerScopesResponse {
    status: number;
    body: { consumer_id?: string; scopes?: HeldScope[]; message?: string } | null;
}

/** Turn the OBP answer into a report: which required Scopes the app's Consumer holds. */
export function evaluateConsumerScopes(
    app: ConsumerApp,
    required: RequiredConsumerScope[],
    response: CurrentConsumerScopesResponse
): ConsumerScopesReport {
    const checked_at = new Date().toISOString();
    const unknown = (problem: string): ConsumerScopesReport =>
        ({ app, checked_at, state: 'unknown', scopes: required.map((r) => ({ ...r, held: false })), problem });
    if (response.status === 404) {
        return unknown(`This OBP-API has no GET ${CURRENT_CONSUMER_SCOPES_PATH}, so the Consumer's Scopes cannot be read.`);
    }
    if (response.status < 200 || response.status >= 300 || !response.body) {
        return unknown(`GET ${CURRENT_CONSUMER_SCOPES_PATH} answered ${response.status}${response.body?.message ? `: ${response.body.message}` : ''}`);
    }
    const scopes = compareConsumerScopes(required, response.body.scopes ?? []);
    const missingRequired = scopes.some((s) => !s.held && !s.optional);
    return { app, checked_at, state: missingRequired ? 'missing' : 'ok', consumer_id: response.body.consumer_id, scopes };
}

/** The /status row for a report. */
export function consumerScopesSnapshot(report: ConsumerScopesReport): Pick<HealthCheckSnapshot, 'status' | 'error' | 'details'> {
    const details: Record<string, string | number> = {};
    if (report.consumer_id) details.consumer_id = report.consumer_id;
    for (const s of report.scopes) {
        details[`${s.role_name} at ${s.bank_id || '(system)'}`] =
            report.state === 'unknown' ? 'unknown' : s.held ? 'held' : s.optional ? 'missing (optional)' : 'missing';
    }
    if (report.state === 'unknown') return { status: 'unknown', error: report.problem, details };
    const missing = report.scopes.filter((s) => !s.held && !s.optional);
    if (missing.length === 0) return { status: 'healthy', error: undefined, details };
    return {
        status: 'unhealthy',
        error: missing.map((s) => `Missing ${s.role_name} at ${s.bank_id || '(system)'}: ${s.without_it}`).join(' '),
        details
    };
}

/**
 * Checks that this app's own OBP Consumer holds the Scopes it needs, by asking OBP which Scopes the
 * Consumer behind its application token holds. The latest report is also served as JSON (see
 * getReport), which is how the API Manager's App Consumers page learns about the Portal's Consumer.
 */
export class ConsumerScopesHealthCheckService extends HealthCheckService {
    private readonly scopeOptions: ConsumerScopesHealthCheckOptions;
    private report: ConsumerScopesReport;
    private running: Promise<void> | null = null;

    constructor(options: ConsumerScopesHealthCheckOptions) {
        super({
            serviceName: options.serviceName,
            url: `${options.obpBaseUrl.replace(/\/$/, '')}${CURRENT_CONSUMER_SCOPES_PATH}`,
            interval: options.interval ?? 60000,
            timeout: options.timeout ?? 5000
        });
        this.scopeOptions = options;
        this.report = {
            app: options.app,
            checked_at: new Date(0).toISOString(),
            state: 'unknown',
            scopes: options.required.map((r) => ({ ...r, held: false })),
            problem: 'Not checked yet.'
        };
    }

    getReport(): ConsumerScopesReport {
        return this.report;
    }

    /** Check again unless the last check is younger than maxAgeMs, e.g. just after a Scope was granted. */
    async refreshIfOlderThan(maxAgeMs: number): Promise<ConsumerScopesReport> {
        if (Date.now() - Date.parse(this.report.checked_at) >= maxAgeMs) await this.performCheck();
        return this.report;
    }

    async performCheck(): Promise<void> {
        // One check at a time: a refresh asked for while the interval's check runs waits for it.
        if (!this.running) {
            this.running = this.check().finally(() => { this.running = null; });
        }
        return this.running;
    }

    private async check(): Promise<void> {
        const { app, required, obpBaseUrl, getApplicationToken, consumerUrl } = this.scopeOptions;
        const start = performance.now();
        let report: ConsumerScopesReport;
        const tokenResult = await getApplicationToken();
        if (tokenResult.token === null) {
            report = {
                app,
                checked_at: new Date().toISOString(),
                state: 'unknown',
                scopes: required.map((r) => ({ ...r, held: false })),
                problem: `No application token: ${tokenResult.reason}.`
            };
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort('timeout'), this.scopeOptions.timeout ?? 5000);
            try {
                const response = await fetch(`${obpBaseUrl.replace(/\/$/, '')}${CURRENT_CONSUMER_SCOPES_PATH}`, {
                    headers: { Authorization: `Bearer ${tokenResult.token}`, Accept: 'application/json' },
                    signal: controller.signal
                });
                const body = await response.json().catch(() => null);
                report = evaluateConsumerScopes(app, required, { status: response.status, body });
            } catch (err) {
                const message = err instanceof Error ? (err.name === 'AbortError' ? 'Request timeout' : err.message) : String(err);
                report = {
                    app,
                    checked_at: new Date().toISOString(),
                    state: 'unknown',
                    scopes: required.map((r) => ({ ...r, held: false })),
                    problem: `Could not reach OBP-API: ${message}`
                };
            } finally {
                clearTimeout(timeoutId);
            }
        }
        this.report = report;
        const snapshot = consumerScopesSnapshot(report);
        if (report.consumer_id && consumerUrl) snapshot.details!.consumer_id_url = consumerUrl(report.consumer_id);
        if (snapshot.status !== 'healthy') logger.warn(`${this.getName()}: ${snapshot.error ?? snapshot.status}`);
        this.state.setSnapshot({
            service: this.getName(),
            responseTimeMs: Math.round(performance.now() - start),
            ...snapshot
        });
    }
}
