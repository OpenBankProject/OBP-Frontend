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
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { webhooksPath, type DynamicEntityWebhook, type WebhookDelivery, type WebhookEntity } from "$lib/services/dynamicEntityWebhooks";
import { loadWebhookEntities, webhookExplorerEndpoints } from "$lib/server/dynamicEntityWebhooks";

const logger = createLogger("DynamicEntityWebhookPage");

const STATUSES = ["PENDING", "DELIVERED", "STICKY"];

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  let webhook: DynamicEntityWebhook;
  try {
    webhook = await obp_requests.get(webhooksPath(params.bank_id, params.dynamic_entity_id, params.webhook_id), token);
  } catch (e) {
    throw error(404, `No webhook ${params.webhook_id} for ${params.dynamic_entity_id} in ${params.bank_id}: ${e instanceof Error ? e.message : String(e)}`);
  }

  // The entity's current fields and types, for the condition editor. Without them the form still works, with the
  // condition fields the webhook already names.
  let entity: WebhookEntity = { dynamic_entity_id: webhook.dynamic_entity_id, entity_name: webhook.entity_name, bank_id: webhook.bank_id, field_types: {} };
  try {
    entity = (await loadWebhookEntities(token, webhook.bank_id)).find((e) => e.dynamic_entity_id === webhook.dynamic_entity_id) ?? entity;
  } catch (e) {
    logger.warn(`Could not load the definition of ${webhook.entity_name}:`, e);
  }

  const status = STATUSES.includes(url.searchParams.get("status") ?? "") ? (url.searchParams.get("status") as string) : "";
  let deliveries: WebhookDelivery[] = [];
  let deliveriesError: string | null = null;
  try {
    const query = new URLSearchParams({ limit: "50", ...(status ? { status } : {}) });
    const resp = await obp_requests.get(`${webhooksPath(webhook.bank_id, webhook.dynamic_entity_id, webhook.webhook_id)}/deliveries?${query}`, token);
    deliveries = resp?.deliveries ?? [];
  } catch (e) {
    deliveriesError = e instanceof Error ? e.message : String(e);
  }

  return {
    webhook,
    entity,
    status,
    deliveries,
    deliveriesError,
    created: url.searchParams.get("created") === "1",
    endpoints: webhookExplorerEndpoints(["get", "update", "delete", "test", "deliveries", "retry"]),
  };
};
