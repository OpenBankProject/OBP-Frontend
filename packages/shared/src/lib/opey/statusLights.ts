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
 * The four status lights beside Opey's input. Each is green, amber or red, and green means that part works fully,
 * so four green lights mean Opey works end to end for this User. Amber means not checked yet (or still connecting);
 * red means broken.
 *
 * 1. server:   this app's server reaches Opey (OPEY_BASE_URL), from /backend/status.
 * 2. browser:  the browser reaches Opey through this app's proxy, the route the chat uses.
 * 3. services: Opey's own services (OBP-API, Redis, checkpoints, OBP-MCP, the LLM) are all up, from Opey's /status.
 * 4. session:  the Opey session is what this User should have: acting as them through an accepted consent when
 *              they are logged in, anonymous when they are not.
 */

export type Light = 'green' | 'amber' | 'red';

/** Plain colours, not theme colours, so the three states look different in every theme. */
export const LIGHT_CLASS: Record<Light, string> = {
	green: 'bg-green-500',
	amber: 'bg-amber-400',
	red: 'bg-red-700'
};

export type ConnectionStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

export function connectionLight(status: ConnectionStatus): Light {
	if (status === 'healthy') return 'green';
	if (status === 'unknown') return 'amber';
	return 'red';
}

export interface OpeyServiceStatus {
	overall?: string;
	components?: Record<string, { up?: boolean } & Record<string, unknown>>;
}

/** Green when Opey reports every component up; red when any is down; amber until Opey has answered. */
export function servicesLight(status: OpeyServiceStatus | null): Light {
	if (!status?.components) return 'amber';
	const components = Object.values(status.components);
	return status.overall === 'ok' && components.every((c) => c.up) ? 'green' : 'red';
}

/** The components Opey reports as down, by name. */
export function downComponents(status: OpeyServiceStatus | null): string[] {
	return Object.entries(status?.components ?? {})
		.filter(([, c]) => !c.up)
		.map(([name]) => name);
}

export interface SessionLightInput {
	status: 'ready' | 'loading' | 'error';
	isAuthenticated: boolean;
	/** The User is logged in to this app, so Opey should act as them. */
	userAuthenticated: boolean;
}

export function sessionLight({ status, isAuthenticated, userAuthenticated }: SessionLightInput): Light {
	if (status === 'loading') return 'amber';
	if (status === 'error') return 'red';
	return userAuthenticated && !isAuthenticated ? 'red' : 'green';
}

export function sessionText({ status, isAuthenticated, userAuthenticated }: SessionLightInput): string {
	if (status === 'loading') return 'Connecting…';
	if (status === 'error') return userAuthenticated ? 'Opey cannot act as you: no accepted consent' : 'Error';
	if (isAuthenticated) return 'Acting as you, through your consent';
	return userAuthenticated ? 'Not acting as you: the session is anonymous' : 'Anonymous (not logged in)';
}

// The words shown when hovering over a light. One sentence each, in plain language; a technical error, when there
// is one, follows in brackets.

const COMPONENT_NAMES: Record<string, string> = {
	obp: 'OBP-API',
	redis: 'Redis',
	checkpointer: 'its conversation store',
	mcp: 'OBP-MCP (its tools)',
	llm: 'its AI model'
};

const withError = (text: string, error?: string | null) => (error ? `${text} (${error.slice(0, 160)})` : text);

export function serverHint(light: Light, error?: string | null): string {
	if (light === 'green') return "This website's server can reach Opey.";
	if (light === 'amber') return "Checking whether this website's server can reach Opey…";
	return withError("This website's server cannot reach Opey.", error);
}

export function browserHint(light: Light, error?: string | null): string {
	if (light === 'green') return 'Your browser can reach Opey through this website.';
	if (light === 'amber') return 'Checking whether your browser can reach Opey…';
	return withError('Your browser cannot reach Opey through this website.', error);
}

export function servicesHint(status: OpeyServiceStatus | null): string {
	const light = servicesLight(status);
	if (light === 'amber') return 'Waiting for Opey to report how its parts are doing…';
	if (light === 'green') return 'All of Opey is working: OBP-API, Redis, its conversation store, OBP-MCP (its tools) and its AI model.';
	const down = downComponents(status).map((name) => COMPONENT_NAMES[name] ?? name);
	return down.length ? `Part of Opey is not working: ${down.join(', ')}.` : 'Opey reports a problem.';
}

export function sessionHint(input: SessionLightInput, error?: string | null): string {
	const { status, isAuthenticated, userAuthenticated } = input;
	if (status === 'loading') return 'Starting your session with Opey…';
	if (status === 'error') {
		return userAuthenticated
			? withError('Opey cannot act as you.', error)
			: withError('Opey could not start a session.', error);
	}
	if (isAuthenticated) return 'Opey is acting as you, with the consent you gave it.';
	return userAuthenticated
		? "You are logged in, but Opey is not acting as you: it has no consent from you."
		: 'You are chatting with Opey as a visitor. Log in to let Opey act as you.';
}
