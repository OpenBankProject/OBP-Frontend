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
    type ConsumerScopesReport,
    type HeldScope,
    type RequiredConsumerScope
} from "$shared/obp/requiredConsumerScopes";

const logger = createLogger('ConsumerScopesHealthCheckService');

export const CURRENT_CONSUMER_SCOPES_PATH = '/obp/v7.0.0/consumers/current/scopes';
export const CURRENT_CONSUMER_PLATFORM_APP_PATH = '/obp/v7.0.0/consumers/current/platform-app';

/** Declare again this often once a declaration has been accepted, in case an administrator re-marked the app. */
const REDECLARE_AFTER_MS = 60 * 60 * 1000;

/** An application token, or why there is none (the shape of requestApplicationAccessToken's result). */
export type ApplicationTokenSource = () => Promise<{ token: string } | { token: null; reason: string }>;

export interface ConsumerScopesHealthCheckOptions {
    serviceName: string;
    required: RequiredConsumerScope[];
    obpBaseUrl: string;
    getApplicationToken: ApplicationTokenSource;
    /** The app's version, sent with its Platform App declaration. */
    version?: string;
    /** Link for the consumer_id on /status, e.g. the API Manager's Platform Apps page. */
    consumerUrl?: (consumerId: string) => string;
    interval?: number;
    timeout?: number;
}

/** An OBP answer, as far as it matters here. */
export interface ObpAnswer {
    status: number;
    body: { consumer_id?: string; scopes?: HeldScope[]; message?: string } | null;
}

/** Turn the answer of GET /consumers/current/scopes into a report: which required Scopes the app's Consumer holds. */
export function evaluateConsumerScopes(required: RequiredConsumerScope[], response: ObpAnswer): ConsumerScopesReport {
    const checked_at = new Date().toISOString();
    const unknown = (problem: string): ConsumerScopesReport =>
        ({ checked_at, state: 'unknown', scopes: required.map((r) => ({ ...r, held: false })), problem });
    if (response.status === 404) {
        return unknown(`This OBP-API has no GET ${CURRENT_CONSUMER_SCOPES_PATH}, so the Consumer's Scopes cannot be read.`);
    }
    if (response.status < 200 || response.status >= 300 || !response.body) {
        return unknown(`GET ${CURRENT_CONSUMER_SCOPES_PATH} answered ${response.status}${response.body?.message ? `: ${response.body.message}` : ''}`);
    }
    const scopes = compareConsumerScopes(required, response.body.scopes ?? []);
    const missingRequired = scopes.some((s) => !s.held && !s.optional);
    return { checked_at, state: missingRequired ? 'missing' : 'ok', consumer_id: response.body.consumer_id, scopes };
}

/** What the answer to the Platform App declaration means, for /status. */
export function describeDeclaration(response: ObpAnswer): { accepted: boolean; text: string } {
    if (response.status >= 200 && response.status < 300) return { accepted: true, text: 'declared' };
    const message = response.body?.message ?? '';
    if (response.status === 404 && message.startsWith('OBP-35046')) {
        return { accepted: false, text: 'not marked: an administrator marks this Consumer on the API Manager\'s Platform Apps page' };
    }
    if (response.status === 404) {
        return { accepted: false, text: 'not supported by this OBP-API (no Platform Apps)' };
    }
    return { accepted: false, text: `declaration refused: ${response.status}${message ? ` ${message}` : ''}` };
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
        error: missing.map((s) => `Missing ${s.role_name} at ${s.bank_id || '(system)'}, needed for: ${s.needed_for}`).join(' '),
        details
    };
}

/**
 * Checks that this app's own OBP Consumer holds the Scopes it needs, by asking OBP which Scopes the
 * Consumer behind its application token holds, and declares those needs to OBP as a Platform App so the
 * API Manager's Platform Apps page can show them. A declaration is refused until an administrator has
 * marked the Consumer; the check keeps trying, so marking takes effect without a restart.
 */
export class ConsumerScopesHealthCheckService extends HealthCheckService {
    private readonly scopeOptions: ConsumerScopesHealthCheckOptions;
    private declaredAt = 0;
    private declaration = 'not yet declared';
    private consumerId: string | undefined;

    constructor(options: ConsumerScopesHealthCheckOptions) {
        super({
            serviceName: options.serviceName,
            url: `${options.obpBaseUrl.replace(/\/$/, '')}${CURRENT_CONSUMER_SCOPES_PATH}`,
            interval: options.interval ?? 60000,
            timeout: options.timeout ?? 5000
        });
        this.scopeOptions = options;
    }

    /** The consumer_id OBP last said this app's application token belongs to. */
    getConsumerId(): string | undefined {
        return this.consumerId;
    }

    async performCheck(): Promise<void> {
        const { required, getApplicationToken, consumerUrl } = this.scopeOptions;
        const start = performance.now();
        let report: ConsumerScopesReport;
        const tokenResult = await getApplicationToken();
        if (tokenResult.token === null) {
            report = {
                checked_at: new Date().toISOString(),
                state: 'unknown',
                scopes: required.map((r) => ({ ...r, held: false })),
                problem: `No application token: ${tokenResult.reason}.`
            };
        } else {
            try {
                report = evaluateConsumerScopes(required, await this.call('GET', CURRENT_CONSUMER_SCOPES_PATH, tokenResult.token));
                if (Date.now() - this.declaredAt > REDECLARE_AFTER_MS) await this.declare(tokenResult.token);
            } catch (err) {
                const message = err instanceof Error ? (err.name === 'AbortError' ? 'Request timeout' : err.message) : String(err);
                report = {
                    checked_at: new Date().toISOString(),
                    state: 'unknown',
                    scopes: required.map((r) => ({ ...r, held: false })),
                    problem: `Could not reach OBP-API: ${message}`
                };
            }
        }
        if (report.consumer_id) this.consumerId = report.consumer_id;
        const snapshot = consumerScopesSnapshot(report);
        if (report.consumer_id && consumerUrl) snapshot.details!.consumer_id_url = consumerUrl(report.consumer_id);
        if (tokenResult.token !== null) snapshot.details!.platform_app = this.declaration;
        if (snapshot.status !== 'healthy') logger.warn(`${this.getName()}: ${snapshot.error ?? snapshot.status}`);
        this.state.setSnapshot({
            service: this.getName(),
            responseTimeMs: Math.round(performance.now() - start),
            ...snapshot
        });
    }

    /** Tell OBP, as this app's Consumer, which Scopes it needs and what for. */
    private async declare(token: string): Promise<void> {
        const body = {
            ...(this.scopeOptions.version ? { version: this.scopeOptions.version } : {}),
            required_scopes: this.scopeOptions.required.map((r) => ({
                role_name: r.role_name,
                bank_id: r.bank_id,
                needed_for: r.needed_for,
                optional: r.optional ?? false
            }))
        };
        const outcome = describeDeclaration(await this.call('PUT', CURRENT_CONSUMER_PLATFORM_APP_PATH, token, body));
        this.declaration = outcome.text;
        this.declaredAt = outcome.accepted ? Date.now() : 0;
    }

    private async call(method: 'GET' | 'PUT', path: string, token: string, body?: unknown): Promise<ObpAnswer> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), this.scopeOptions.timeout ?? 5000);
        try {
            const response = await fetch(`${this.scopeOptions.obpBaseUrl.replace(/\/$/, '')}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    ...(body ? { 'Content-Type': 'application/json' } : {})
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
                signal: controller.signal
            });
            return { status: response.status, body: await response.json().catch(() => null) };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
