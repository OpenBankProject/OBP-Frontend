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

/**
 * The three plain HTTP endpoints every app answers, modelled on OBP-API (AliveCheckRoutes.scala and StatusPage.scala):
 *
 * - GET /alive answers 200 with the JSON body `true`. It checks nothing.
 * - GET /health answers 200 with `{"status":"ok"}`. It checks nothing either: it only shows that the process serves HTTP.
 * - GET /status runs the app's checks and answers 503 when an essential one fails. It returns JSON when the request's Accept header prefers application/json, and an HTML page otherwise.
 *
 * All three must be reachable without logging in, and none of them may be cached, so each response says `Cache-Control: no-store`.
 */
import type { HealthCheckSnapshot } from '$shared/health-check/state/HealthCheckState';
import type { RedisClientProvider } from '$shared/server/health-check/RedisHealthCheckService';

// A probe must always see the live answer, never a copy kept by a browser, proxy or CDN.
const NO_STORE = 'no-store';

// How long a single /status check may take before it counts as failed.
const CHECK_TIMEOUT_MS = 5000;

/** The answer for GET /alive: 200 and the JSON body `true`, as OBP-API's /alive gives. */
export function aliveResponse(): Response {
    return new Response('true', {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE }
    });
}

/** The answer for GET /health: 200 and `{"status":"ok"}`, as OBP-API's /health gives. It must never look at Redis, a database or OBP-API. */
export function healthResponse(): Response {
    return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE }
    });
}

/** What one check found. `detail` explains a failure in a few words, without host names or addresses, because /status is public. */
export interface StatusCheckResult {
    ok: boolean;
    detail?: string;
}

/** One check on the /status page. */
export interface StatusCheck {
    /** The key in the JSON `checks` object, for example `obp_api`. */
    name: string;
    /** When an essential check fails, /status answers 503. A failed check that is not essential shows as `warn` and leaves the status code at 200. */
    essential: boolean;
    run: () => Promise<StatusCheckResult>;
}

/** The build the running app came from, as the apps' vite config stamps it (__APP_VERSION__, __GIT_COMMIT__, __GIT_BRANCH__, __BUILD_TIME__). */
export interface StatusBuildInfo {
    version: string;
    commit: string;
    branch: string;
    buildTime: string;
}

export interface StatusPageOptions {
    /** The app's name, for the page title, for example "Cohort". */
    appName: string;
    build: StatusBuildInfo;
    checks: StatusCheck[];
}

/** What one check shows: `ok`, `fail` for a failed essential check, or `warn` for a failed check that is not essential. */
type CheckOutcome = 'ok' | 'fail' | 'warn';

interface CheckReport {
    status: CheckOutcome;
    essential: boolean;
    detail?: string;
}

/**
 * True when the Accept header prefers JSON to HTML, so `curl -H 'Accept: application/json'` and monitoring tools get JSON and a browser gets the page.
 * JSON wins when application/json is listed with a quality above zero and text/html is not given a higher quality. A wildcard such as `*\/*` alone gets HTML, as it does from OBP-API.
 */
export function prefersJson(acceptHeader: string | null): boolean {
    if (!acceptHeader) return false;
    // The highest quality given to each media type we care about; 0 means "not listed".
    let jsonQuality = 0;
    let htmlQuality = 0;
    for (const mediaRange of acceptHeader.split(',')) {
        const [mediaType, ...parameters] = mediaRange.trim().toLowerCase().split(';');
        const qualityParameter = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith('q='));
        const quality = qualityParameter ? Number(qualityParameter.slice(2)) : 1;
        if (Number.isNaN(quality)) continue;
        if (mediaType.trim() === 'application/json') jsonQuality = Math.max(jsonQuality, quality);
        if (mediaType.trim() === 'text/html') htmlQuality = Math.max(htmlQuality, quality);
    }
    return jsonQuality > 0 && jsonQuality >= htmlQuality;
}

/** Runs a check, and counts it as failed when it throws or takes longer than CHECK_TIMEOUT_MS. */
async function runWithTimeout(check: StatusCheck): Promise<StatusCheckResult> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<StatusCheckResult>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ ok: false, detail: `no answer within ${CHECK_TIMEOUT_MS / 1000} seconds` }), CHECK_TIMEOUT_MS);
    });
    try {
        return await Promise.race([check.run(), timeout]);
    } catch (err) {
        return { ok: false, detail: describeError(err) };
    } finally {
        clearTimeout(timeoutHandle);
    }
}

/** A short reason for a failure. It names the error code (such as ECONNREFUSED) but not the address, which would publish the deployment's internal host names. */
function describeError(err: unknown): string {
    const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
    const code = cause?.code ?? (err as { code?: string } | undefined)?.code;
    if (code) return `could not connect (${code})`;
    if (err instanceof Error && err.name === 'TimeoutError') return 'timed out';
    return 'could not connect';
}

/** Runs every check at the same time and returns the /status response: JSON or HTML, 503 when an essential check failed, otherwise 200. */
export async function statusResponse(request: Request, options: StatusPageOptions): Promise<Response> {
    const results = await Promise.all(options.checks.map((check) => runWithTimeout(check)));
    const checks: Record<string, CheckReport> = {};
    options.checks.forEach((check, index) => {
        const result = results[index];
        const outcome: CheckOutcome = result.ok ? 'ok' : check.essential ? 'fail' : 'warn';
        checks[check.name] = { status: outcome, essential: check.essential, ...(result.detail ? { detail: result.detail } : {}) };
    });
    const allEssentialOk = Object.values(checks).every((report) => report.status !== 'fail');
    const overall = allEssentialOk ? 'ok' : 'degraded';
    const statusCode = allEssentialOk ? 200 : 503;
    const body = {
        status: overall,
        app: options.appName,
        version: options.build.version,
        git_commit: options.build.commit,
        git_branch: options.build.branch,
        git_build_time: options.build.buildTime,
        uptime_seconds: Math.floor(process.uptime()),
        checks
    };
    if (prefersJson(request.headers.get('accept'))) {
        return new Response(JSON.stringify(body, null, 2), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE }
        });
    }
    return new Response(statusHtml(body, checks), {
        status: statusCode,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_STORE }
    });
}

function htmlEscape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The colours OBP-API's status page uses: green for ok, orange for warn, red for fail or degraded.
const OUTCOME_COLOURS: Record<string, string> = { ok: '#2e7d32', warn: '#ef6c00', fail: '#c62828', degraded: '#c62828' };

/** A plain page, like OBP-API's, so it still renders when the app's own pages cannot. */
function statusHtml(
    body: { status: string; app: string; version: string; git_commit: string; git_branch: string; git_build_time: string; uptime_seconds: number },
    checks: Record<string, CheckReport>
): string {
    const badge = (outcome: string) => `<span style="color: ${OUTCOME_COLOURS[outcome] ?? '#c62828'}; font-weight: bold;">${htmlEscape(outcome)}</span>`;
    const checkRows = Object.entries(checks)
        .map(([checkName, report]) => {
            const kind = report.essential ? '' : ' <span style="color: #666;">(does not affect the overall status)</span>';
            const detail = report.detail ? `<div style="color: #666; font-size: 0.85em; margin-top: 4px;">${htmlEscape(report.detail)}</div>` : '';
            return `<tr><th>${htmlEscape(checkName)}</th><td>${badge(report.status)}${kind}${detail}</td></tr>`;
        })
        .join('\n');
    const title = `${htmlEscape(body.app)} - Status`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
h1 { color: #333; }
h2 { color: #555; margin-top: 30px; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 6px 12px; text-align: left; border-bottom: 1px solid #eee; vertical-align: top; }
th { width: 180px; }
</style>
</head>
<body>
<h1>${htmlEscape(body.app)} Status: ${badge(body.status)}</h1>
<h2>Instance</h2>
<table>
<tr><th>version</th><td>${htmlEscape(body.version)}</td></tr>
<tr><th>git_commit</th><td>${htmlEscape(body.git_commit)}</td></tr>
<tr><th>git_branch</th><td>${htmlEscape(body.git_branch)}</td></tr>
<tr><th>git_build_time</th><td>${htmlEscape(body.git_build_time)}</td></tr>
<tr><th>uptime_seconds</th><td>${body.uptime_seconds}</td></tr>
</table>
<h2>Checks</h2>
<table>
${checkRows}
</table>
</body>
</html>
`;
}

/** Whether OBP-API answers its v5.1.0 root endpoint, which needs no login. */
export function obpApiCheck(obpBaseUrl: string | undefined, essential = true): StatusCheck {
    return {
        name: 'obp_api',
        essential,
        run: async () => {
            if (!obpBaseUrl) return { ok: false, detail: 'PUBLIC_OBP_BASE_URL is not set' };
            const rootUrl = `${obpBaseUrl.replace(/\/+$/, '')}/obp/v5.1.0/root`;
            const response = await fetch(rootUrl, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
            return response.ok ? { ok: true } : { ok: false, detail: `HTTP ${response.status}` };
        }
    };
}

/** Whether Redis answers PING. The apps keep their sessions there, so nobody can log in without it. */
export function redisCheck(redisProvider: RedisClientProvider, essential = true): StatusCheck {
    return {
        name: 'redis',
        essential,
        run: async () => {
            const pingAnswer = await redisProvider.getClient().ping();
            return pingAnswer === 'PONG' ? { ok: true } : { ok: false, detail: 'unexpected answer to PING' };
        }
    };
}

/** Anything that keeps a health check snapshot, such as a HealthCheckService the app runs in the background. */
export interface SnapshotSource {
    getSnapshot(): HealthCheckSnapshot;
}

/**
 * The last result of a check the app already runs in the background, such as its Consumer Scopes check. It reads the snapshot and makes no call of its own.
 * A check that has not reported yet counts as failed, because a result we do not have proves nothing.
 */
export function snapshotCheck(name: string, source: SnapshotSource, essential = false): StatusCheck {
    return {
        name,
        essential,
        run: async () => {
            const snapshot = source.getSnapshot();
            if (snapshot.status === 'healthy') return { ok: true };
            if (snapshot.status === 'unknown') return { ok: false, detail: 'not checked yet' };
            return { ok: false, detail: "failed; the app's setup page shows why" };
        }
    };
}
