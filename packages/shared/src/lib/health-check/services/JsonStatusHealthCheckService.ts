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
import type { HealthCheckSnapshot } from "../state/HealthCheckState";

const logger = createLogger('JsonStatusHealthCheckService');

export interface JsonStatusEvaluation {
    status: HealthCheckSnapshot['status'];
    error?: string;
    details: Record<string, string | number>;
}

export interface JsonStatusHealthCheckOptions extends Omit<HealthCheckOptions, 'url' | 'method' | 'body' | 'expectedStatus'> {
    /** The JSON status endpoint; null when it is not known (the check then reports 'unknown' with `missingReason`). */
    url: string | null | (() => Promise<string | null>);
    /** Turns the endpoint's JSON into a verdict. */
    evaluate: (payload: any) => JsonStatusEvaluation;
    missingReason?: string;
}

/**
 * A check that reads a JSON status endpoint (asking for JSON, which Opey and OBP-MCP content-negotiate) and lets
 * `evaluate` decide: for checks that need more than "the URL answers 200", such as which mode a server runs in.
 */
export class JsonStatusHealthCheckService extends HealthCheckService {
    private readonly target: JsonStatusHealthCheckOptions['url'];
    private readonly evaluate: JsonStatusHealthCheckOptions['evaluate'];
    private readonly staticDetails: Record<string, string | number>;
    private readonly timeoutMs: number;
    private readonly missingReason: string;

    constructor(options: JsonStatusHealthCheckOptions) {
        super({
            serviceName: options.serviceName,
            url: typeof options.url === 'string' ? options.url : '',
            method: 'GET',
            headers: options.headers ?? {},
            timeout: options.timeout ?? 5000,
            interval: options.interval ?? 60000,
            details: options.details
        });
        this.target = options.url;
        this.evaluate = options.evaluate;
        this.staticDetails = options.details ?? {};
        this.timeoutMs = options.timeout ?? 5000;
        this.missingReason = options.missingReason ?? 'no URL configured';
    }

    async performCheck(): Promise<void> {
        const start = performance.now();
        const url = typeof this.target === 'function' ? await this.target().catch(() => null) : this.target;
        if (!url) {
            this.setResult({ status: 'unknown', error: this.missingReason, details: {} }, 0);
            return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), this.timeoutMs);
        try {
            const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
            const elapsed = Math.round(performance.now() - start);
            if (!response.ok) {
                this.setResult({ status: 'unhealthy', error: `${url} returned ${response.status} ${response.statusText}`, details: { url } }, elapsed);
                return;
            }
            let payload: unknown;
            try {
                payload = await response.json();
            } catch {
                this.setResult({ status: 'unhealthy', error: `${url} did not return JSON`, details: { url } }, elapsed);
                return;
            }
            const evaluation = this.evaluate(payload);
            if (evaluation.status !== 'healthy') {
                logger.warn(`${this.getName()}: ${evaluation.status}${evaluation.error ? ` — ${evaluation.error}` : ''}`);
            }
            this.setResult({ ...evaluation, details: { url, ...evaluation.details } }, elapsed);
        } catch (err) {
            const message = err instanceof Error ? (err.name === 'AbortError' ? 'Request timeout' : err.message) : String(err);
            this.setResult({ status: 'unhealthy', error: `${url}: ${message}`, details: { url } }, Math.round(performance.now() - start));
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private setResult(evaluation: JsonStatusEvaluation, responseTimeMs: number): void {
        this.state.setSnapshot({
            service: this.getName(),
            status: evaluation.status,
            responseTimeMs,
            error: evaluation.error,
            details: { ...this.staticDetails, ...evaluation.details }
        });
    }
}
