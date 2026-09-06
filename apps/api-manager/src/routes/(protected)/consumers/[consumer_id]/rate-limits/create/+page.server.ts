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
import { error, fail, redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("CreateConsumerRateLimitServer");

interface Consumer {
  consumer_id: string;
  app_name: string;
  app_type: string;
  description: string;
  developer_email: string;
  enabled: boolean;
  created: string;
}

export async function load(event: RequestEvent) {
  const session = event.locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  const consumerId = event.params.consumer_id;
  if (!consumerId) {
    error(400, {
      message: "Consumer ID is required.",
    });
  }

  let consumer: Consumer | undefined = undefined;

  try {
    // Fetch consumer details
    consumer = await obp_requests.get(
      `/obp/v6.0.0/management/consumers/${consumerId}`,
      token,
    );

    logger.debug(`Retrieved consumer: ${consumer?.app_name}`);
  } catch (e) {
    logger.error("Error fetching consumer:", e);
    error(404, {
      message: "Consumer not found.",
    });
  }

  if (!consumer) {
    error(404, {
      message: "Consumer not found.",
    });
  }

  return {
    consumer,
  };
}

export const actions = {
  default: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, {
        error: "Unauthorized",
      });
    }

    // Get the OAuth session data
    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, {
        error: "Unauthorized: No access token found in session.",
      });
    }

    const consumerId = event.params.consumer_id;
    if (!consumerId) {
      return fail(400, {
        error: "Consumer ID is required.",
      });
    }

    const formData = await event.request.formData();
    const from_date = formData.get("from_date") as string;
    const to_date = formData.get("to_date") as string;
    const per_second_call_limit = formData.get(
      "per_second_call_limit",
    ) as string;
    const per_minute_call_limit = formData.get(
      "per_minute_call_limit",
    ) as string;
    const per_hour_call_limit = formData.get("per_hour_call_limit") as string;
    const per_day_call_limit = formData.get("per_day_call_limit") as string;
    const per_week_call_limit = formData.get("per_week_call_limit") as string;
    const per_month_call_limit = formData.get("per_month_call_limit") as string;
    const bank_id = formData.get("bank_id") as string;
    const api_name = formData.get("api_name") as string;
    const api_version = formData.get("api_version") as string;

    // Validation
    if (!from_date || !to_date) {
      return fail(400, {
        error: "From date and To date are required.",
        from_date,
        to_date,
      });
    }

    // Validate that at least one limit is set
    const hasLimit =
      per_second_call_limit ||
      per_minute_call_limit ||
      per_hour_call_limit ||
      per_day_call_limit ||
      per_week_call_limit ||
      per_month_call_limit;

    if (!hasLimit) {
      return fail(400, {
        error: "At least one rate limit must be specified.",
        from_date,
        to_date,
      });
    }

    // Build request body - format dates as ISO 8601 with time (no milliseconds)
    // Convert YYYY-MM-DD to YYYY-MM-DDTHH:MM:SSZ
    const fromDateISO = `${from_date}T00:00:00Z`;
    const toDateISO = `${to_date}T23:59:59Z`;

    const requestBody: any = {
      from_date: fromDateISO,
      to_date: toDateISO,
      per_second_call_limit: per_second_call_limit || "-1",
      per_minute_call_limit: per_minute_call_limit || "-1",
      per_hour_call_limit: per_hour_call_limit || "-1",
      per_day_call_limit: per_day_call_limit || "-1",
      per_week_call_limit: per_week_call_limit || "-1",
      per_month_call_limit: per_month_call_limit || "-1",
    };

    try {
      logger.debug(`Creating rate limit for consumer ${consumerId}`);

      await obp_requests.post(
        `/obp/v6.0.0/management/consumers/${consumerId}/consumer/rate-limits`,
        requestBody,
        token,
      );

      logger.info(`Successfully created rate limit for consumer ${consumerId}`);
    } catch (e: any) {
      logger.error("Error creating rate limit:", e);
      return fail(500, {
        error: e.message || "Failed to create rate limit. Please try again.",
        from_date,
        to_date,
      });
    }

    // Redirect back to rate limits page
    throw redirect(303, `/consumers/${consumerId}/rate-limits`);
  },
};
