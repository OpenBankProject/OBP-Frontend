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

// The role check itself is shared by every OBP-Frontend app; this file keeps the API Manager's page registry.
import type { RoleRequirement } from "@obp/shared/roles";
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";
export { checkRoles, groupMissingRolesByBank } from "@obp/shared/roles";
export type { RoleRequirement, RoleCheckResult, UserEntitlement } from "@obp/shared/roles";

/**
 * Page role configuration: required roles block access, optional roles show info notes.
 * - requirementType "OR" (default): user needs at least ONE of the required roles
 * - requirementType "AND": user needs ALL of the required roles
 */
export interface PageRoleConfig {
  required: RoleRequirement[];
  optional?: RoleRequirement[];
  /** "OR" = user needs any one role (default), "AND" = user needs all roles */
  requirementType?: "OR" | "AND";
}

/**
 * Centralised page role registry keyed by route path (without /(protected) prefix).
 * - `required`: user needs at least one (OR logic) to view the page
 * - `optional`: additional roles that enable extra actions (e.g. create/delete buttons)
 */
export const SITE_MAP: Record<string, PageRoleConfig> = {
  // ── RBAC ──────────────────────────────────────────────
  "/rbac/roles": {
    required: [{ role: "CanGetRolesWithEntitlementCountsAtAllBanks" }],
  },
  "/rbac/entitlements": {
    required: [{ role: "CanGetEntitlementsForAnyUserAtAnyBank" }],
  },
  "/rbac/entitlements/create": {
    required: [
      { role: "CanCreateEntitlementAtAnyBank" },
      { role: "CanCreateEntitlementAtOneBank" },
    ],
  },
  "/rbac/entitlements/[entitlement_id]/delete": {
    required: [
      { role: "CanDeleteEntitlementAtAnyBank" },
    ],
  },
  "/rbac/entitlement-requests": {
    required: [{ role: "CanGetEntitlementRequestsAtAnyBank" }],
    optional: [
      { role: "CanCreateEntitlementAtAnyBank" },
      { role: "CanDeleteEntitlementRequestsAtAnyBank" },
    ],
  },
  "/rbac/groups": {
    required: [{ role: "CanGetGroupsAtAllBanks" }],
  },
  "/rbac/groups/create": {
    required: [{ role: "CanCreateGroupAtAllBanks" }],
  },
  "/rbac/groups/[group_id]": {
    required: [{ role: "CanGetEntitlementsForAnyBank" }],
  },
  "/rbac/groups/[group_id]/edit": {
    required: [{ role: "CanUpdateGroupAtAllBanks" }],
  },
  "/rbac/groups/[group_id]/delete": {
    required: [{ role: "CanDeleteGroupAtAllBanks" }],
  },
  "/rbac/memberships": {
    required: [
      { role: "CanGetEntitlementsForAnyBank" },
      { role: "CanGetGroupsAtAllBanks" },
    ],
    requirementType: "AND",
  },
  "/rbac/memberships/create": {
    required: [{ role: "CanCreateUserAuthContext" }],
  },

  // ── System ────────────────────────────────────────────
  "/system/cache": {
    required: [{ role: "CanGetCacheConfig" }, { role: "CanGetCacheInfo" }],
    optional: [{ role: "CanInvalidateCacheNamespace" }],
  },
  "/system/config-props": {
    required: [{ role: "CanGetConfigProps" }],
  },
  "/system/log-cache": {
    required: [{ role: "CanGetSystemLogCacheAll" }],
  },
  "/system/migrations": {
    required: [{ role: "CanGetMigrations" }],
  },
  "/system/database-pool": {
    required: [{ role: "CanGetDatabasePoolInfo" }],
  },
  "/system/webui-props/create": {
    required: [{ role: "CanCreateWebUiProps" }],
  },
  "/system/webui-props/[id]/edit": {
    required: [{ role: "CanCreateWebUiProps" }],
  },
  "/system/webui-props/[id]/delete": {
    required: [{ role: "CanDeleteWebUiProps" }],
  },
  "/system/scheduler-job-locks": {
    required: [{ role: "CanGetSchedulerJobLocks" }],
  },
  "/system/scheduler-job-locks/[job_id]/delete": {
    required: [{ role: "CanDeleteSchedulerJobLock" }],
  },
  "/system/self-test-emails": {
    required: [{ role: "CanCreateTestEmail" }],
  },
  "/system/rate-limiting": {
    required: [{ role: "CanGetConfig" }],
  },
  "/system/rate-limiting/help": {
    required: [],
  },
  "/system/signal-channels": {
    required: [],
  },
  "/system/signal-channels-stats": {
    required: [{ role: "CanGetSignalStats" }],
  },
  "/system/featured-collections": {
    required: [{ role: "CanManageFeaturedApiCollections" }],
  },
  "/system/featured-collections/add": {
    required: [{ role: "CanManageFeaturedApiCollections" }],
  },
  "/system/featured-collections/[collection_id]/edit": {
    required: [{ role: "CanManageFeaturedApiCollections" }],
  },
  "/system/featured-collections/[collection_id]/delete": {
    required: [{ role: "CanManageFeaturedApiCollections" }],
  },

  // ── Products ────────────────────────────────────────────
  "/products/financial": {
    required: [],
  },
  "/products/financial/all-banks": {
    required: [],
  },
  "/products/financial/create": {
    required: [{ role: "CanCreateProduct", bankScoped: true }],
    optional: [{ role: "CanCreateProductAttribute", bankScoped: true }],
  },
  "/products/financial/[bank_id]/[product_code]": {
    required: [],
  },
  "/products/financial/[bank_id]/[product_code]/edit": {
    required: [{ role: "CanCreateProduct", bankScoped: true }],
    optional: [
      { role: "CanCreateProductAttribute", bankScoped: true },
      { role: "CanUpdateProductAttribute", bankScoped: true },
      { role: "CanUpdateProductTagsAtOneBank", bankScoped: true },
      { role: "CanUpdateProductTagsAtAnyBank" },
    ],
  },
  "/products/collections": {
    required: [],
  },
  "/products/bootstrap": {
    required: [{ role: "CanUpdateApiProduct", bankScoped: true }],
    optional: [{ role: "CanDeleteApiProduct", bankScoped: true }],
  },

  // ── Banks ─────────────────────────────────────────────
  "/banks/create": {
    required: [{ role: "CanCreateBank" }],
  },

  // ── Consumers ─────────────────────────────────────────
  "/consumers": {
    required: [{ role: "CanGetConsumers" }],
  },
  "/consumers/[consumer_id]/edit": {
    required: [{ role: "CanGetConsumers" }],
  },
  "/consumers/platform-apps": {
    required: [{ role: "CanGetPlatformApps" }],
    optional: [
      { role: "CanCreatePlatformApp" },
      { role: "CanDeletePlatformApp" },
      { role: "CanCreateScopeAtAnyBank" },
    ],
  },
  "/consumers/[consumer_id]/rate-limits/[rate_limiting_id]/edit": {
    required: [{ role: "CanUpdateRateLimits" }],
  },
  "/consumers/[consumer_id]/rate-limits/[rate_limiting_id]/delete": {
    required: [{ role: "CanDeleteRateLimits" }],
  },

  // ── Dashboard ─────────────────────────────────────────
  // Renders for everyone; each tile needs one of the optional roles and shows the
  // Request Entitlement widget itself when its fetch comes back 403.
  "/system-activity-dashboard/active-consumers": {
    required: [{ role: "CanReadMetrics" }],
    optional: [{ role: "CanReadAggregateMetrics" }],
  },
  "/system-activity-dashboard/active-users": {
    required: [{ role: "CanReadMetrics" }],
    optional: [{ role: "CanReadAggregateMetrics" }],
  },
  "/system-activity-dashboard/new-users": {
    required: [{ role: "CanGetAnyUser" }],
  },
  "/system-activity-dashboard": {
    required: [],
    optional: [
      { role: "CanReadAggregateMetrics" },
      { role: "CanGetAnyUser" },
      { role: "CanGetConsumers" },
    ],
  },

  // ── Metrics ───────────────────────────────────────────
  "/metrics": {
    required: [{ role: "CanReadMetrics" }],
  },
  "/aggregate-metrics-live": {
    required: [{ role: "CanReadAggregateMetrics" }],
  },
  "/aggregate-metrics-trends": {
    required: [{ role: "CanReadAggregateMetrics" }],
  },
  "/connector-traces": {
    required: [{ role: "CanGetConnectorTrace" }],
  },
  "/connector-metrics": {
    required: [{ role: "CanGetConnectorMetrics" }],
  },
  "/connector-counts": {
    required: [{ role: "CanGetConnectorMetrics" }],
  },
  "/metrics-diagnostics": {
    required: [{ role: "CanGetMetricsDiagnostics" }],
  },
  "/telemetry": {
    required: [{ role: "CanGetTelemetry" }],
  },
  "/deployment-checks": {
    required: [{ role: "CanGetConfig" }],
  },
  "/metrics-archive-run": {
    required: [{ role: "CanCreateMetricsArchiveRun" }],
  },

  // ── ABAC ──────────────────────────────────────────────
  "/abac/rules": {
    required: [{ role: "CanGetAbacRule" }],
  },
  "/abac/rules/create": {
    required: [{ role: "CanCreateAbacRule" }],
  },
  "/abac/rules/[rule_id]/edit": {
    required: [{ role: "CanUpdateAbacRule" }],
  },
  "/abac/rules/[rule_id]/test": {
    required: [{ role: "CanUpdateAbacRule" }],
  },

  // ── Account Access ────────────────────────────────────
  "/account-access/system-views/create": {
    required: [
      { role: "CanCreateSystemView" },
      { role: "CanGetViewPermissionsAtAllBanks" },
    ],
    requirementType: "AND",
  },
  "/account-access/system-views/[view_id]/edit": {
    required: [
      { role: "CanUpdateSystemView" },
      { role: "CanGetViewPermissionsAtAllBanks" },
    ],
    requirementType: "AND",
  },
  "/account-access/custom-views/create": {
    required: [{ role: "CanCreateCustomView" }],
  },
  "/account-access/account-directory": {
    required: [{ role: "CanGetAccountDirectoryAtOneBank", bankScoped: true }],
  },
  "/account-access/accounts/[bank_id]/[account_id]/[view_id]": {
    required: [],
    optional: [{ role: "CanExecuteAbacRule" }],
  },

  // ── Mandates ────────────────────────────────────────────
  "/mandates/[bank_id]/[account_id]": {
    required: [{ role: "CanGetMandate", bankScoped: true }],
  },
  "/mandates/[bank_id]/[account_id]/create": {
    required: [{ role: "CanCreateMandate", bankScoped: true }],
  },
  "/mandates/[bank_id]/[account_id]/[mandate_id]": {
    required: [{ role: "CanGetMandate", bankScoped: true }],
    optional: [
      { role: "CanCreateSignatoryPanel", bankScoped: true },
      { role: "CanCreateMandateProvision", bankScoped: true },
      { role: "CanGetSignatoryPanel", bankScoped: true },
      { role: "CanGetMandateProvision", bankScoped: true },
    ],
  },

  // ── Customers ───────────────────────────────────────────
  "/customers/individual": {
    required: [{ role: "CanGetCustomersAtOneBank", bankScoped: true }],
    optional: [
      { role: "CanCreateCustomerAtOneBank", bankScoped: true },
      { role: "CanUpdateCustomerIdentity", bankScoped: true },
    ],
  },
  "/customers/corporate": {
    required: [{ role: "CanGetCustomersAtOneBank", bankScoped: true }],
    optional: [
      { role: "CanCreateCustomerAtOneBank", bankScoped: true },
      { role: "CanUpdateCustomerIdentity", bankScoped: true },
    ],
  },

  // ── Users ─────────────────────────────────────────────
  "/users": {
    required: [{ role: "CanGetAnyUser" }],
  },
  "/users/[user_id]": {
    required: [{ role: "CanGetAnyUser" }],
  },
  "/users/[provider]/[username]": {
    required: [{ role: "CanGetAnyUser" }],
  },
  "/users/[provider]/[username]/unlock": {
    required: [{ role: "CanUnlockUser" }],
  },
  "/users/[provider]/[username]/lock": {
    required: [{ role: "CanLockUser" }],
  },
  "/users/[user_id]/validate-email": {
    required: [{ role: "CanGetAnyUser" }],
  },
  "/users/[user_id]/reset-password": {
    required: [{ role: "CanCreateResetPasswordUrl" }],
  },

  // ── Integration ─────────────────────────────────────
  "/integration/method-routings": {
    required: [{ role: "CanGetMethodRoutings" }],
    optional: [
      { role: "CanCreateMethodRouting" },
      { role: "CanUpdateMethodRouting" },
    ],
  },

  // ── Chat Rooms ────────────────────────────────────────
  "/chat-rooms/system": {
    required: [],
  },
  "/chat-rooms/bank": {
    required: [],
  },
  "/chat-rooms/[chat_room_id]": {
    required: [],
  },
  "/chat-rooms/[chat_room_id]/edit": {
    required: [
      { role: "CanSetSystemChatRoomIsOpenRoom" },
      { role: "CanSetBankChatRoomIsOpenRoom", bankScoped: true },
    ],
    requirementType: "OR",
  },

  // ── Dynamic Entities ──────────────────────────────────
  "/dynamic-entities/diagnostics": {
    // The Definition Roles are held at the bank id of the space they cover; SYS is the system space.
    required: [{ role: "CanGetDynamicEntityDefinitions", bankId: DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID }],
  },

  // ── Dynamic Endpoints ─────────────────────────────────
  "/dynamic-endpoints/system": {
    required: [{ role: "CanGetDynamicEndpoints" }],
    optional: [
      { role: "CanCreateDynamicEndpoint" },
      { role: "CanDeleteDynamicEndpoint" },
    ],
  },
  "/dynamic-endpoints/system/[id]": {
    required: [{ role: "CanGetDynamicEndpoints" }],
    optional: [
      { role: "CanUpdateDynamicEndpoint" },
      { role: "CanDeleteDynamicEndpoint" },
      { role: "CanCreateJsonSchemaValidation" },
      { role: "CanUpdateJsonSchemaValidation" },
      { role: "CanDeleteJsonSchemaValidation" },
      { role: "CanGetAllEndpointMappings" },
      { role: "CanCreateEndpointMapping" },
      { role: "CanUpdateEndpointMapping" },
      { role: "CanDeleteEndpointMapping" },
    ],
  },
  "/dynamic-endpoints/system/create": {
    required: [{ role: "CanCreateDynamicEndpoint" }],
  },
  "/dynamic-endpoints/bank": {
    required: [
      { role: "CanGetBankLevelDynamicEndpoints", bankScoped: true },
      { role: "CanGetDynamicEndpoints" },
    ],
    optional: [
      { role: "CanCreateBankLevelDynamicEndpoint", bankScoped: true },
      { role: "CanCreateDynamicEndpoint" },
      { role: "CanDeleteBankLevelDynamicEndpoint", bankScoped: true },
      { role: "CanDeleteDynamicEndpoint" },
    ],
  },
  "/dynamic-endpoints/bank/[bank_id]/[id]": {
    required: [
      { role: "CanGetBankLevelDynamicEndpoints", bankScoped: true },
      { role: "CanGetDynamicEndpoints" },
    ],
    optional: [
      { role: "CanUpdateBankLevelDynamicEndpoint", bankScoped: true },
      { role: "CanUpdateDynamicEndpoint" },
      { role: "CanDeleteBankLevelDynamicEndpoint", bankScoped: true },
      { role: "CanDeleteDynamicEndpoint" },
      { role: "CanCreateJsonSchemaValidation" },
      { role: "CanUpdateJsonSchemaValidation" },
      { role: "CanDeleteJsonSchemaValidation" },
      { role: "CanGetAllBankLevelEndpointMappings", bankScoped: true },
      { role: "CanGetAllEndpointMappings" },
      { role: "CanCreateBankLevelEndpointMapping", bankScoped: true },
      { role: "CanCreateEndpointMapping" },
      { role: "CanUpdateBankLevelEndpointMapping", bankScoped: true },
      { role: "CanUpdateEndpointMapping" },
      { role: "CanDeleteBankLevelEndpointMapping", bankScoped: true },
      { role: "CanDeleteEndpointMapping" },
    ],
  },
  "/dynamic-endpoints/bank/[bank_id]/create": {
    required: [
      { role: "CanCreateBankLevelDynamicEndpoint", bankScoped: true },
      { role: "CanCreateDynamicEndpoint" },
    ],
  },

  // ── Dynamic Resource Docs ─────────────────────────────
  "/dynamic-resource-docs/system": {
    required: [{ role: "CanGetDynamicResourceDoc" }],
    optional: [
      { role: "CanCreateDynamicResourceDoc" },
      { role: "CanUpdateDynamicResourceDoc" },
      { role: "CanDeleteDynamicResourceDoc" },
    ],
  },
  "/dynamic-resource-docs/system/create": {
    required: [{ role: "CanCreateDynamicResourceDoc" }],
  },
  "/dynamic-resource-docs/system/[id]": {
    required: [{ role: "CanGetDynamicResourceDoc" }],
    optional: [
      { role: "CanUpdateDynamicResourceDoc" },
      { role: "CanDeleteDynamicResourceDoc" },
    ],
  },

  // ── Dynamic Glossary Items ────────────────────────────
  // Reading needs no role beyond an authenticated user; only the writes are role-gated.
  "/glossary-items": {
    required: [],
    optional: [
      { role: "CanCreateGlossaryItem" },
      { role: "CanUpdateGlossaryItem" },
      { role: "CanDeleteGlossaryItem" },
    ],
  },
  "/glossary-items/create": {
    required: [{ role: "CanCreateGlossaryItem" }],
  },
  "/glossary-items/[title]": {
    required: [],
    optional: [
      { role: "CanUpdateGlossaryItem" },
      { role: "CanDeleteGlossaryItem" },
    ],
  },

  // ── Glossary ──────────────────────────────────────────
  // GET /obp/v7.0.0/api/glossary is open unless the instance sets
  // apiOptions.glossaryDocsRequireRole, which then demands CanReadGlossary.
  "/glossary": {
    required: [],
    optional: [{ role: "CanReadGlossary" }],
  },
  "/glossary/[title]": {
    required: [],
    optional: [{ role: "CanReadGlossary" }],
  },

  // ── Message Docs ──────────────────────────────────────
  // GET /message-docs/CONNECTOR takes no role: adapter authors need it before they have an account.
  "/message-docs/[connector]": {
    required: [],
  },
  "/message-docs/[connector]/[process]": {
    required: [],
  },
};


/**
 * Look up page roles by route ID (stripping /(protected) prefix if present)
 */
export function getPageRoles(routeId: string): PageRoleConfig | undefined {
  const key = routeId.replace("/(protected)", "");
  return SITE_MAP[key];
}
