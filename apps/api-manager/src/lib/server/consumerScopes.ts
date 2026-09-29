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
import { env as publicEnv } from "$env/dynamic/public";
import { ConsumerScopesHealthCheckService } from "@obp/shared/health-check";
import { REQUIRED_CONSUMER_SCOPES } from "@obp/shared/obp";
import { requestApplicationAccessToken } from "$lib/server/oauth/applicationToken";

/**
 * Whether the API Manager's own OBP Consumer holds the Scopes its application-token calls need.
 * Shown on /status; also declares those needs to OBP, for the Platform Apps page.
 */
export const consumerScopesCheck = new ConsumerScopesHealthCheckService({
  serviceName: "OBP Consumer scopes",
  required: REQUIRED_CONSUMER_SCOPES["api-manager"],
  obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? "",
  getApplicationToken: requestApplicationAccessToken,
  version: __APP_VERSION__,
  consumerUrl: () => "/consumers/platform-apps",
});
