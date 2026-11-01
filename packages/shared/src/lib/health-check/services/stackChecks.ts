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
import type { JsonStatusEvaluation } from './JsonStatusHealthCheckService';

/**
 * Verdicts for the checks of the Opey stack shown on /status: whether Opey can answer (its AI model), whether it
 * checks consents with the same OBP-API as this app, whether OBP-API allows consents at all, and whether each
 * OBP-MCP copy runs in the mode it is used for. Each says in words what is wrong when it is not healthy.
 */

const sameOrigin = (a: string, b: string): boolean => {
    const norm = (u: string) => {
        try {
            const url = new URL(u);
            const host = url.hostname === '127.0.0.1' ? 'localhost' : url.hostname;
            return `${url.protocol}//${host}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
        } catch {
            return u.replace(/\/+$/, '');
        }
    };
    return norm(a) === norm(b);
};

/** Opey's AI model: the `llm` component of Opey's /status (a placeholder or refused key is down, with Opey's reason). */
export function evaluateOpeyModel(payload: any): JsonStatusEvaluation {
    const llm = payload?.components?.llm;
    if (!llm) return { status: 'unknown', error: 'This Opey build does not report its AI model', details: {} };
    const details: Record<string, string | number> = {};
    if (llm.provider) details.provider = String(llm.provider);
    if (llm.detail) details.detail = String(llm.detail);
    return llm.up === true
        ? { status: 'healthy', details }
        : { status: 'unhealthy', error: `Opey cannot answer: ${llm.detail ?? 'its AI model is not available'}`, details };
}

/** Opey → OBP-API: up, and the same OBP-API as this app, or the consents this app gives Opey mean nothing to it. */
export function evaluateOpeyObp(expectedObpBaseUrl: string): (payload: any) => JsonStatusEvaluation {
    return (payload) => {
        const obp = payload?.components?.obp;
        if (!obp) return { status: 'unknown', error: 'This Opey build does not report its OBP-API', details: {} };
        const details: Record<string, string | number> = { expected: expectedObpBaseUrl };
        if (obp.base_url) details.opey_uses = String(obp.base_url);
        if (obp.up !== true) return { status: 'unhealthy', error: 'Opey cannot reach its OBP-API', details };
        if (!obp.base_url) return { status: 'unknown', error: 'This Opey build does not say which OBP-API it uses', details };
        if (!sameOrigin(String(obp.base_url), expectedObpBaseUrl)) {
            return {
                status: 'unhealthy',
                error: `Opey uses ${obp.base_url}, this app ${expectedObpBaseUrl}: the consents this app gives Opey are unknown there. Set OBP_BASE_URL in Opey's .env.`,
                details
            };
        }
        return { status: 'healthy', details };
    };
}

/** OBP-API's public consent configuration: with consents.allowed off, Opey can never act for a User. */
export function evaluateConsentConfig(payload: any): JsonStatusEvaluation {
    if (typeof payload?.consents_allowed !== 'boolean') return { status: 'unknown', error: 'OBP-API does not report its consent configuration', details: {} };
    const details: Record<string, string | number> = { consents_allowed: String(payload.consents_allowed) };
    if (typeof payload.sca_enabled === 'boolean') details.sca_enabled = String(payload.sca_enabled);
    if (payload.max_time_to_live_in_seconds !== undefined) details.max_time_to_live_in_seconds = payload.max_time_to_live_in_seconds;
    return payload.consents_allowed
        ? { status: 'healthy', details }
        : { status: 'unhealthy', error: 'consents.allowed is off in OBP-API: no consent works, so Opey cannot act for any User', details };
}

/** An OBP-MCP copy runs in the mode it is used for: consent for Opey, oauth for outside MCP clients. */
export function evaluateMcpMode(expectedMode: 'consent' | 'oauth'): (payload: any) => JsonStatusEvaluation {
    return (payload) => {
        const auth = payload?.auth;
        const mode = auth?.mode ?? auth?.outbound_auth_via;
        if (!mode) return { status: 'unknown', error: 'This OBP-MCP does not report its mode', details: {} };
        const details: Record<string, string | number> = { mode: String(mode), expected: expectedMode };
        if (auth.provider) details.provider = String(auth.provider);
        const unreachable = (auth.issuers ?? []).filter((i: any) => i?.reachable === false).map((i: any) => i.issuer_url);
        if (mode !== expectedMode) {
            return {
                status: 'unhealthy',
                error: `Runs in ${mode} mode, but is used in ${expectedMode} mode (${expectedMode === 'consent' ? 'by Opey' : 'by MCP clients such as Claude Code'})`,
                details
            };
        }
        if (unreachable.length) return { status: 'unhealthy', error: `Cannot reach its identity provider: ${unreachable.join(', ')}`, details };
        return { status: 'healthy', details };
    };
}
