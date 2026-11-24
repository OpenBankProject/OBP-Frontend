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
import { env as publicEnv } from '$env/dynamic/public';
import { obpApiCheck, redisCheck, snapshotCheck, statusResponse } from '@obp/shared/server/probes';
import { redisService } from '$lib/server/redis';
import { consumerScopesCheck } from '$lib/server/consumerScopes';

/**
 * Readiness, as OBP-API's /status: it checks what Conformator needs and answers 503 when OBP-API or Redis does not answer.
 * Conformator keeps all its data in OBP-API and its sessions in Redis, so it cannot serve without either.
 * The Consumer Scopes check is shown but does not change the status code, because routing traffic away does not grant missing Scopes.
 * It returns JSON when the request's Accept header prefers application/json, and a plain page otherwise. It needs no login.
 */
export const GET: RequestHandler = async ({ request }) =>
	statusResponse(request, {
		appName: 'Conformator',
		build: { version: __APP_VERSION__, commit: __GIT_COMMIT__, branch: __GIT_BRANCH__, buildTime: __BUILD_TIME__ },
		checks: [
			obpApiCheck(publicEnv.PUBLIC_OBP_BASE_URL),
			redisCheck(redisService),
			snapshotCheck('consumer_scopes', consumerScopesCheck)
		]
	});
