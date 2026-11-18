/*
 * Copyright (C) 2026 TESOBE GmbH
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
import type { Send } from './http';

/**
 * A client for the OpenID Foundation's conformance suite, run beside the runner, through its REST API: create a test
 * plan from the participant's configuration, run each of its modules, and read the results. It follows the suite's own
 * client (scripts/conformance.py in its repository): POST /api/plan, POST /api/runner, GET /api/runner/{id}/wait-state,
 * POST /api/runner/{id} to start a module that waits to be started, and GET /api/info/{id}.
 */

export interface OpenIdSuiteSettings {
	/** Its base URL, such as https://localhost.emobix.co.uk:8443. */
	baseUrl: string;
	/** An API token, when the suite is not run in its development mode. */
	token?: string;
	/** The CA of the suite's own TLS certificate, when it is not a public one. */
	ca?: string;
	/** The longest one module may take, in milliseconds. */
	moduleTimeoutMs: number;
}

/** The suite's verdict on one module. */
export type ModuleResult = 'PASSED' | 'WARNING' | 'REVIEW' | 'FAILED' | 'SKIPPED' | 'UNKNOWN';

export interface ModuleOutcome {
	module: string;
	id: string;
	result: ModuleResult;
	status: string;
	log_url: string;
}

/** The suite could not be used: unreachable, refused the request, or a module never finished. A harness problem. */
export class SuiteProblem extends Error {}

export interface PlanRequest {
	plan: string;
	variant?: Record<string, string>;
	/** Run only these modules of the plan; all of them when left out. */
	modules?: string[];
}

export function openIdSuite(settings: OpenIdSuiteSettings, send: Send, now: () => number = Date.now) {
	const base = settings.baseUrl.replace(/\/+$/, '');

	async function call(method: string, path: string, query: Record<string, string> = {}, body?: unknown, timeoutMs = 30_000): Promise<{ status: number; json: any }> {
		const qs = new URLSearchParams(query).toString();
		const url = `${base}${path}${qs ? `?${qs}` : ''}`;
		let response;
		try {
			response = await send({
				method,
				url,
				headers: {
					accept: 'application/json',
					...(body !== undefined ? { 'content-type': 'application/json' } : {}),
					...(settings.token ? { authorization: `Bearer ${settings.token}` } : {})
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				tls: settings.ca ? { ca: settings.ca } : undefined,
				timeoutMs
			});
		} catch (err) {
			throw new SuiteProblem(`The OpenID conformance suite at ${base} could not be reached: ${(err as Error).message}`);
		}
		let json: any = null;
		try {
			json = response.text ? JSON.parse(response.text) : null;
		} catch {
			json = null;
		}
		return { status: response.status, json };
	}

	const expect = (r: { status: number; json: any }, status: number, what: string) => {
		if (r.status !== status) throw new SuiteProblem(`The OpenID conformance suite refused to ${what} (${r.status}${r.json?.error ? `: ${r.json.error}` : r.json?.message ? `: ${r.json.message}` : ''}).`);
		return r.json;
	};

	/** Wait until a module is in one of the states, using the suite's long poll, up to the module time limit. */
	async function waitFor(id: string, states: string[], deadline: number): Promise<string> {
		const wanted = [...states, 'INTERRUPTED'].join(',');
		while (true) {
			const remaining = deadline - now();
			if (remaining <= 0) throw new SuiteProblem(`Module ${id} did not reach ${states.join(' or ')} in time.`);
			const perCall = Math.min(remaining, 30_000);
			const r = await call('GET', `/api/runner/${encodeURIComponent(id)}/wait-state`, { states: wanted, timeoutMs: String(perCall) }, undefined, perCall + 10_000);
			if (r.status === 404) {
				// The suite lost the module from memory (a restart); its stored status says whether it finished.
				const info = await call('GET', `/api/info/${encodeURIComponent(id)}`);
				const persisted = info.json?.status;
				if (persisted === 'FINISHED' || persisted === 'INTERRUPTED') return persisted;
				throw new SuiteProblem(`The OpenID conformance suite lost module ${id} (it may have restarted).`);
			}
			const body = expect(r, 200, `report on module ${id}`);
			if (body?.timeout) continue;
			if (typeof body?.state === 'string') return body.state;
		}
	}

	return {
		/**
		 * Run a test plan against the participant's server with their configuration, module by module, and give each
		 * module's verdict. A module that waits to be started is started; one waiting for a person to log in relies on
		 * the configuration's browser steps, as the suite's own scripts do.
		 */
		async runPlan(request: PlanRequest, configuration: unknown): Promise<{ planId: string; planUrl: string; modules: ModuleOutcome[] }> {
			const plan = expect(
				await call('POST', '/api/plan', { planName: request.plan, ...(request.variant ? { variant: JSON.stringify(request.variant) } : {}) }, configuration),
				201,
				`create the plan ${request.plan}`
			);
			const planId = String(plan?.id ?? '');
			const listed: Array<{ testModule: string; variant?: Record<string, string> }> = Array.isArray(plan?.modules) ? plan.modules : [];
			const chosen = request.modules ? listed.filter((m) => request.modules!.includes(m.testModule)) : listed;
			if (chosen.length === 0) throw new SuiteProblem(`The plan ${request.plan} has none of the modules asked for.`);
			const modules: ModuleOutcome[] = [];
			for (const m of chosen) {
				const deadline = now() + settings.moduleTimeoutMs;
				const created = expect(
					await call('POST', '/api/runner', { test: m.testModule, plan: planId, ...(m.variant ? { variant: JSON.stringify(m.variant) } : {}) }),
					201,
					`start the module ${m.testModule}`
				);
				const id = String(created?.id ?? '');
				let state = await waitFor(id, ['CONFIGURED', 'WAITING', 'FINISHED'], deadline);
				if (state === 'CONFIGURED') {
					expect(await call('POST', `/api/runner/${encodeURIComponent(id)}`), 200, `start module ${id}`);
					state = await waitFor(id, ['WAITING', 'FINISHED'], deadline);
				}
				if (state === 'WAITING') state = await waitFor(id, ['FINISHED'], deadline);
				const info = expect(await call('GET', `/api/info/${encodeURIComponent(id)}`), 200, `give the result of module ${id}`);
				modules.push({
					module: m.testModule,
					id,
					status: String(info?.status ?? state),
					result: (['PASSED', 'WARNING', 'REVIEW', 'FAILED', 'SKIPPED'].includes(info?.result) ? info.result : 'UNKNOWN') as ModuleResult,
					log_url: `${base}/log-detail.html?log=${encodeURIComponent(id)}`
				});
			}
			return { planId, planUrl: `${base}/plan-detail.html?plan=${encodeURIComponent(planId)}`, modules };
		}
	};
}

export type OpenIdSuite = ReturnType<typeof openIdSuite>;

/**
 * One outcome for a plan's modules, as a test's outcome:
 * - fail when any module failed;
 * - not executed when a module needs a person to review it (REVIEW), so the regulator's reviewer decides;
 * - blocked on the harness side when a module was interrupted or gave no verdict, or every module was skipped;
 * - pass otherwise. Warnings pass, and are listed.
 */
export function planOutcome(modules: ModuleOutcome[]): { outcome: 'pass' | 'fail' | 'blocked' | 'not_executed'; blocked_by?: 'harness'; actual: string } {
	const named = (result: ModuleResult) => modules.filter((m) => m.result === result).map((m) => m.module);
	const failed = named('FAILED');
	const review = named('REVIEW');
	const warned = named('WARNING');
	const unknown = modules.filter((m) => m.result === 'UNKNOWN' || m.status === 'INTERRUPTED').map((m) => m.module);
	const counted = modules.filter((m) => m.result !== 'SKIPPED').length;
	const warnings = warned.length ? ` Warnings in: ${warned.join(', ')}.` : '';
	if (failed.length) return { outcome: 'fail', actual: `The OpenID conformance suite failed ${failed.join(', ')}.${warnings}` };
	if (unknown.length) return { outcome: 'blocked', blocked_by: 'harness', actual: `The OpenID conformance suite gave no verdict for ${unknown.join(', ')}.` };
	if (counted === 0) return { outcome: 'blocked', blocked_by: 'harness', actual: 'The OpenID conformance suite skipped every module of the plan.' };
	if (review.length) return { outcome: 'not_executed', actual: `The OpenID conformance suite asks a person to review ${review.join(', ')}: a reviewer decides this test.${warnings}` };
	return { outcome: 'pass', actual: `The OpenID conformance suite passed ${counted} module${counted === 1 ? '' : 's'}.${warnings}` };
}
