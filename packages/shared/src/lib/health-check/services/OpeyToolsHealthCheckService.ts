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

const logger = createLogger('OpeyToolsHealthCheckService');

/**
 * Checks whether the Opey agent actually has its OBP tools, not merely whether
 * the Opey process answers HTTP. Opey can be alive with zero MCP tools loaded
 * (mcp_servers.json missing from the deployment, OBP-MCP down or unrouted) —
 * the chat then answers every request with "my API tools are currently
 * unavailable" while a liveness check stays green.
 *
 * Reads GET {opeyBaseUrl}/status with Accept: application/json. Opey builds
 * from 2026-07 onward return a components map including an `mcp` probe;
 * older builds return a bare {"status":"ok"}, in which case tool health is
 * genuinely unknowable from outside and the check reports 'unknown'.
 */
export interface OpeyToolsHealthCheckOptions extends Omit<HealthCheckOptions, 'url' | 'method' | 'body' | 'expectedStatus'> {
    opeyBaseUrl: string;
}

/** The `mcp` component of Opey's /status JSON (newer builds). */
interface OpeyMcpComponent {
    up?: boolean;
    tool_count?: number;
    test_call?: string;
    detail?: string;
    latency_ms?: number;
    obp_mcp_outbound_auth_via?: string;
}

interface OpeyStatusPayload {
    status?: string;
    overall?: string;
    version?: string;
    components?: {
        mcp?: OpeyMcpComponent;
        [key: string]: unknown;
    };
}

export interface OpeyToolsEvaluation {
    status: HealthCheckSnapshot['status'];
    error?: string;
    details: Record<string, string | number>;
}

/**
 * Map an Opey /status payload to a tools-health verdict.
 *
 * Mirrors Opey's own probe semantics: `components.mcp.up` decides health. A
 * failed unauthenticated `test_call` alone does not demote — servers with
 * inbound auth enabled reject the test call even when per-request
 * authenticated tool loading works fine — but it is surfaced in details.
 */
export function evaluateOpeyToolsStatus(payload: OpeyStatusPayload): OpeyToolsEvaluation {
    const mcp = payload.components?.mcp;

    if (!mcp || typeof mcp !== 'object') {
        return {
            status: 'unknown',
            details: {
                tool_status: 'not reported — this Opey build predates MCP health in /status; upgrade Opey to monitor tools'
            }
        };
    }

    const details: Record<string, string | number> = {};
    if (mcp.tool_count !== undefined) details.tool_count = mcp.tool_count;
    if (mcp.test_call !== undefined) details.test_call = mcp.test_call;
    if (mcp.obp_mcp_outbound_auth_via !== undefined) details.obp_mcp_auth = mcp.obp_mcp_outbound_auth_via;
    if (mcp.detail !== undefined) details.detail = mcp.detail;
    if (payload.version !== undefined) details.opey_version = payload.version;
    if (payload.overall !== undefined) details.opey_overall = payload.overall;

    if (mcp.up !== true) {
        return {
            status: 'unhealthy',
            error: mcp.detail
                ? `Opey reports its MCP tools down: ${mcp.detail}`
                : 'Opey reports its MCP tools down — the agent will tell users its API tools are unavailable',
            details
        };
    }

    return { status: 'healthy', details };
}

export class OpeyToolsHealthCheckService extends HealthCheckService {
    private readonly statusUrl: string;
    private readonly staticDetails: Record<string, string | number>;
    private readonly timeoutMs: number;

    constructor(options: OpeyToolsHealthCheckOptions) {
        super({
            serviceName: options.serviceName,
            url: `${options.opeyBaseUrl.replace(/\/$/, '')}/status`,
            method: 'GET',
            headers: options.headers ?? {},
            timeout: options.timeout ?? 5000,
            interval: options.interval ?? 60000,
            details: options.details
        });
        this.statusUrl = `${options.opeyBaseUrl.replace(/\/$/, '')}/status`;
        this.staticDetails = options.details ?? {};
        this.timeoutMs = options.timeout ?? 5000;
    }

    async performCheck(): Promise<void> {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), this.timeoutMs);

        try {
            const response = await fetch(this.statusUrl, {
                method: 'GET',
                // Opey content-negotiates /status; without this a browser-style
                // Accept header gets the HTML page back.
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            const elapsed = Math.round(performance.now() - start);

            if (!response.ok) {
                this.setResult({
                    status: 'unhealthy',
                    error: `Opey /status returned ${response.status} ${response.statusText}`,
                    details: {}
                }, elapsed);
                return;
            }

            let payload: OpeyStatusPayload;
            try {
                payload = await response.json() as OpeyStatusPayload;
            } catch {
                this.setResult({
                    status: 'unhealthy',
                    error: 'Opey /status did not return JSON',
                    details: {}
                }, Math.round(performance.now() - start));
                return;
            }

            const evaluation = evaluateOpeyToolsStatus(payload);
            if (evaluation.status !== 'healthy') {
                logger.warn(`Opey tools check for ${this.getName()}: ${evaluation.status}${evaluation.error ? ` — ${evaluation.error}` : ''}`);
            }
            this.setResult(evaluation, Math.round(performance.now() - start));
        } catch (err) {
            const elapsed = Math.round(performance.now() - start);
            const message = err instanceof Error
                ? (err.name === 'AbortError' ? 'Request timeout' : err.message)
                : String(err);
            logger.error(`Opey tools check for ${this.getName()} failed: ${message}`);
            this.setResult({ status: 'unhealthy', error: message, details: {} }, elapsed);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private setResult(evaluation: OpeyToolsEvaluation, responseTimeMs: number): void {
        this.state.setSnapshot({
            service: this.getName(),
            status: evaluation.status,
            responseTimeMs,
            // Explicitly overwrite so an error from a previous unhealthy result
            // does not linger on an 'unknown' snapshot (only 'healthy' clears it).
            error: evaluation.error,
            details: { ...this.staticDetails, ...evaluation.details }
        });
    }
}
