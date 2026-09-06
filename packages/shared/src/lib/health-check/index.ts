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
export { HealthCheckRegistry, healthCheckRegistry } from './HealthCheckRegistry.js';
export { HealthCheckService } from './services/HealthCheckService.js';
export type { HealthCheckOptions } from './services/HealthCheckService.js';
export { OIDCHealthCheckService } from './services/OIDCHealthCheckService.js';
export type { OIDCHealthCheckOptions, OIDCProviderStatus } from './services/OIDCHealthCheckService.js';
export { OpeyToolsHealthCheckService, evaluateOpeyToolsStatus } from './services/OpeyToolsHealthCheckService.js';
export type { OpeyToolsHealthCheckOptions, OpeyToolsEvaluation } from './services/OpeyToolsHealthCheckService.js';
export { HealthCheckState } from './state/HealthCheckState.js';
export type { HealthCheckSnapshot } from './state/HealthCheckState.js';
export { summarizeHealth } from './summarize.js';
export {
	sseProbeResponse,
	runSseProbe,
	SSE_PROBE_PATH,
	SSE_PROBE_EVENT_COUNT,
	SSE_PROBE_SPACING_MS
} from './sseProbe.js';
export type { SseProbeResult } from './sseProbe.js';
export type { HealthSummary, ServiceHealthView, OverallStatus } from './summarize.js';
