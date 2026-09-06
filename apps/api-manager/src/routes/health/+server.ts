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
import type { RequestHandler } from './$types';

/**
 * Liveness probe: this process is up and serving HTTP. It deliberately checks nothing else.
 *
 * It used to require every monitored dependency to be healthy and answer 503 otherwise, which is
 * readiness logic in a liveness endpoint. An orchestrator polling /health would then restart a
 * perfectly functional API Manager because a secondary OAuth2 provider was down — it keeps serving
 * pages either way, so killing it only widens an unrelated outage.
 *
 * It also flattened the nuance /status already encodes: summarizeHealth treats the OAuth2 providers
 * as one group, so one dead provider alongside a working one is 'partial', not a failure. `every()`
 * turned any single unhealthy check — including a provider that was never configured — into a hard
 * 503. And it counted "no checks registered" as healthy, the opposite of the rule summarizeHealth
 * states for that case ('unknown', never 'healthy').
 *
 * Ask /ready for dependency health -- it is the readiness half of this split and answers 503 when
 * the dependencies are not there, so a load balancer can route on it. /status renders the same
 * verdict for a human but is a page and always answers 200, so it cannot serve as a probe.
 * This /health matches the one OBP-API and Hola serve.
 */
export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify({ status: 'ok' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
