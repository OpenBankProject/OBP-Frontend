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
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";
import { error } from "@sveltejs/kit";
import type { OBPWebUIPropsResponse } from "$lib/obp/types";
import type { RequestEvent } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("WebUIPropsServer");

export async function load(event: RequestEvent) {
  const session = event.locals.session;
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  // Get filter from URL params, default to 'active'
  const filter = event.url.searchParams.get("what") || "active";

  // Validate filter
  if (!["active", "database", "config"].includes(filter)) {
    error(400, {
      message:
        "Invalid filter parameter. Must be 'active', 'database', or 'config'.",
    });
  }

  let propsResponse: OBPWebUIPropsResponse | undefined = undefined;

  try {
    propsResponse = await obp_requests.get(
      `/obp/v6.0.0/webui-props?what=${filter}`,
      token,
    );
    logger.debug(
      `Retrieved ${propsResponse?.webui_props?.length || 0} webui props with filter: ${filter}`,
    );
  } catch (e) {
    logger.error("Error fetching webui props:", e);
    error(500, {
      message:
        "Could not fetch webui props at this time. Please try again later.",
    });
  }

  if (!propsResponse || !propsResponse.webui_props) {
    error(500, {
      message:
        "Could not fetch webui props at this time. Please try again later.",
    });
  }

  const webui_props = propsResponse.webui_props;

  // Debug: Log first prop to see structure
  if (webui_props.length > 0) {
    logger.debug(
      "Sample prop structure:",
      JSON.stringify(webui_props[0], null, 2),
    );
  }

  // Sort webui_props by name
  webui_props.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  logger.debug(`Total webui_props after processing: ${webui_props.length}`);

  return {
    webui_props,
    filter,
  };
}
