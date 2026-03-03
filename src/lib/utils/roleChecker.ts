import { createLogger } from "$lib/utils/logger";
const logger = createLogger("RoleChecker");

/**
 * Role requirement definition for a page or action
 */
export interface RoleRequirement {
  role: string;
  bankId?: string;
  /** When true, the user must hold this role for the current bank (bank-level role) */
  bankScoped?: boolean;
}

/**
 * Page role configuration: required roles block access, optional roles show info notes
 */
export interface PageRoleConfig {
  required: RoleRequirement[];
  optional?: RoleRequirement[];
}

/**
 * Result of checking role requirements
 */
export interface RoleCheckResult {
  hasAllRoles: boolean;
  missingRoles: RoleRequirement[];
  hasRoles: RoleRequirement[];
}

/**
 * User entitlement from session
 */
export interface UserEntitlement {
  entitlement_id: string;
  role_name: string;
  bank_id: string;
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
  "/rbac/groups/create": {
    required: [{ role: "CanCreateGroupAtAllBanks" }],
  },
  "/rbac/groups/[group_id]": {
    required: [{ role: "CanGetEntitlementsForAnyBank" }],
  },
  "/rbac/groups/[group_id]/delete": {
    required: [{ role: "CanDeleteGroupAtAllBanks" }],
  },
  "/rbac/memberships": {
    required: [
      { role: "CanGetEntitlementsForAnyBank" },
      { role: "CanGetGroupsAtAllBanks" },
    ],
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
  "/consumers/[consumer_id]/rate-limits/[rate_limiting_id]/edit": {
    required: [{ role: "CanUpdateRateLimits" }],
  },
  "/consumers/[consumer_id]/rate-limits/[rate_limiting_id]/delete": {
    required: [{ role: "CanDeleteRateLimits" }],
  },

  // ── Metrics ───────────────────────────────────────────
  "/connector-traces": {
    required: [{ role: "CanGetConnectorTrace" }],
  },
  "/connector-metrics": {
    required: [{ role: "CanGetConnectorMetrics" }],
  },
  "/connector-counts": {
    required: [{ role: "CanGetConnectorMetrics" }],
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
  },
  "/account-access/system-views/[view_id]/edit": {
    required: [
      { role: "CanUpdateSystemView" },
      { role: "CanGetViewPermissionsAtAllBanks" },
    ],
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

  // ── Integration ─────────────────────────────────────
  "/integration/method-routings": {
    required: [{ role: "CanGetMethodRoutings" }],
    optional: [
      { role: "CanCreateMethodRouting" },
      { role: "CanUpdateMethodRouting" },
    ],
  },

  // ── Dynamic Entities ──────────────────────────────────
  "/dynamic-entities/diagnostics": {
    required: [{ role: "CanGetSystemLevelDynamicEntities" }],
  },
};

/**
 * Look up page roles by route ID (stripping /(protected) prefix if present)
 */
export function getPageRoles(routeId: string): PageRoleConfig | undefined {
  const key = routeId.replace("/(protected)", "");
  return SITE_MAP[key];
}

/**
 * Check if a user has at least one of the required roles (OR logic).
 *
 * The requiredRoles list represents alternative roles — the user needs ANY ONE
 * of them to gain access. For example, createEntitlement lists
 * CanCreateEntitlementAtAnyBank and CanCreateEntitlementAtOneBank as alternatives.
 *
 * @param userEntitlements - List of entitlements the user has
 * @param requiredRoles - List of alternative roles (user needs at least one)
 * @param currentBankId - The currently selected bank ID (for bankScoped role checks)
 * @returns RoleCheckResult with missing and present roles
 */
export function checkRoles(
  userEntitlements: UserEntitlement[],
  requiredRoles: RoleRequirement[],
  currentBankId?: string,
): RoleCheckResult {
  const missingRoles: RoleRequirement[] = [];
  const hasRoles: RoleRequirement[] = [];

  for (const requirement of requiredRoles) {
    const hasRole = userEntitlements.some((entitlement) => {
      const roleMatches = entitlement.role_name === requirement.role;

      if (!roleMatches) return false;

      // Bank-scoped roles must match the current bank
      if (requirement.bankScoped) {
        return currentBankId ? entitlement.bank_id === currentBankId : false;
      }

      if (requirement.bankId) {
        return entitlement.bank_id === requirement.bankId;
      }

      return true;
    });

    if (hasRole) {
      hasRoles.push(requirement);
    } else {
      missingRoles.push(requirement);
    }
  }

  logger.debug(
    `Role check: ${hasRoles.length}/${requiredRoles.length} roles present`,
  );

  // OR logic: user needs at least one of the required roles
  const hasAnyRequired =
    requiredRoles.length === 0 || hasRoles.length > 0;

  if (!hasAnyRequired) {
    logger.warn("Missing roles:", missingRoles.map((r) => r.role).join(", "));
  }

  return {
    hasAllRoles: hasAnyRequired,
    missingRoles: hasAnyRequired ? [] : missingRoles,
    hasRoles,
  };
}

/**
 * Group missing roles by bank_id for display purposes
 */
export function groupMissingRolesByBank(
  missingRoles: RoleRequirement[],
): Map<string, RoleRequirement[]> {
  const grouped = new Map<string, RoleRequirement[]>();

  for (const requirement of missingRoles) {
    const key = requirement.bankId || "system-wide";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(requirement);
  }

  return grouped;
}
