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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("CustomViewsAPI");

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for custom view creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  const { bank_id, account_id } = params;

  if (!bank_id) {
    return json({ message: "Bank ID is required", code: 400 }, { status: 400 });
  }

  if (!account_id) {
    return json({ message: "Account ID is required", code: 400 }, { status: 400 });
  }

  try {
    const body = await request.json();

    logger.info("=== CREATE CUSTOM VIEW API CALL ===");
    logger.info(`Bank ID: ${bank_id}`);
    logger.info(`Account ID: ${account_id}`);
    logger.info(`View Name: ${body.name}`);

    // Build the payload for the OBP API
    const payload: any = {
      name: body.name,
      description: body.description,
      is_public: body.is_public || false,
      metadata_view: body.metadata_view || "_0",
      which_alias_to_use: body.which_alias_to_use || "",
      hide_metadata_if_alias_used: body.hide_metadata_if_alias_used || false,
      allowed_actions: body.allowed_actions || [],
    };

    // Add all permission fields that are enabled
    const permissionFields = [
      // Transaction permissions
      "can_see_transaction_this_bank_account",
      "can_see_transaction_other_bank_account",
      "can_see_transaction_metadata",
      "can_see_transaction_label",
      "can_see_transaction_amount",
      "can_see_transaction_type",
      "can_see_transaction_currency",
      "can_see_transaction_start_date",
      "can_see_transaction_finish_date",
      "can_see_transaction_balance",
      // Account permissions
      "can_see_bank_account_owners",
      "can_see_bank_account_type",
      "can_see_bank_account_balance",
      "can_see_bank_account_currency",
      "can_see_bank_account_label",
      "can_see_bank_account_national_identifier",
      "can_see_bank_account_swift_bic",
      "can_see_bank_account_iban",
      "can_see_bank_account_number",
      "can_see_bank_account_bank_name",
      "can_see_bank_account_credit_limit",
      // Counterparty permissions
      "can_see_other_account_national_identifier",
      "can_see_other_account_swift_bic",
      "can_see_other_account_iban",
      "can_see_other_account_bank_name",
      "can_see_other_account_number",
      "can_see_other_account_metadata",
      "can_see_other_account_kind",
      "can_see_public_alias",
      "can_see_private_alias",
      // Other permissions
      "can_see_comments",
      "can_see_narrative",
      "can_see_tags",
      "can_see_images",
      "can_see_more_info",
      "can_see_url",
      "can_see_image_url",
      "can_see_where_tag",
      // Write permissions
      "can_add_comment",
      "can_delete_comment",
      "can_add_tag",
      "can_delete_tag",
      "can_add_image",
      "can_delete_image",
      "can_edit_narrative",
      "can_create_counterparty",
      "can_add_transaction_request_to_own_account",
      "can_add_transaction_request_to_any_account",
    ];

    // Add each permission field if it exists in the request body
    permissionFields.forEach((field) => {
      if (body[field] !== undefined) {
        payload[field] = body[field];
      }
    });

    // Make the API call to create the custom view
    const endpoint = `/obp/v6.0.0/banks/${bank_id}/accounts/${account_id}/views`;
    logger.info(`Creating custom view at: ${endpoint}`);

    const response = await obp_requests.post(endpoint, payload, accessToken);

    logger.info(`Custom view created successfully: ${response.id}`);

    return json(response, { status: 201 });
  } catch (err) {
    logger.error("Error creating custom view:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
