/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { createLogger } from '../utils/index.js';
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from '../obp/dynamicEntitySpace.js';

/**
 * Checking whether a User holds the Roles a page or an action needs, for every OBP-Frontend app. Moved here from the
 * API Manager, which keeps its page registry (SITE_MAP) and uses this check.
 */

const logger = createLogger('RoleChecker');

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
 * Result of checking role requirements
 */
export interface RoleCheckResult {
  hasAllRoles: boolean;
  missingRoles: RoleRequirement[];
  hasRoles: RoleRequirement[];
  /** Roles the user doesn't explicitly have, but JIT will auto-grant on use */
  jitRoles: RoleRequirement[];
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
 * Roles excluded from JIT auto-granting (to prevent privilege escalation).
 */
const JIT_EXCLUDED_ROLES = new Set([
  "CanCreateEntitlementAtOneBank",
  "CanCreateEntitlementAtAnyBank",
]);

/**
 * Check whether JIT can cover a missing role for this user.
 * JIT requires:
 * - JIT feature enabled on the OBP instance
 * - User holds CanCreateEntitlementAtAnyBank (system-wide), OR
 *   CanCreateEntitlementAtOneBank for the relevant bank (bank-scoped roles)
 * - The missing role is not one of the excluded meta-roles
 * - The role is not at the Dynamic Entity system space (SYS): OBP never grants there just in time
 *
 * Only real (database) entitlements count as grant-capable. /users/current also
 * returns virtual entitlements (super_admin_user_ids / oidc_operator_user_ids props)
 * with an empty entitlement_id; the OBP JIT grant logic only honours real
 * entitlements, so counting virtual ones here would promise a grant that never happens.
 */
function canJitGrant(
  requirement: RoleRequirement,
  userEntitlements: UserEntitlement[],
  currentBankId?: string,
): boolean {
  if (JIT_EXCLUDED_ROLES.has(requirement.role)) return false;
  if ((requirement.bankId || currentBankId) === DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID) return false;

  const realEntitlements = userEntitlements.filter((e) => e.entitlement_id);

  // CanCreateEntitlementAtAnyBank covers everything
  const hasAnyBank = realEntitlements.some(
    (e) => e.role_name === "CanCreateEntitlementAtAnyBank",
  );
  if (hasAnyBank) return true;

  // For bank-scoped roles, CanCreateEntitlementAtOneBank at the relevant bank also works
  if (requirement.bankScoped || requirement.bankId) {
    const bankId = requirement.bankId || currentBankId;
    if (!bankId) return false;
    return realEntitlements.some(
      (e) => e.role_name === "CanCreateEntitlementAtOneBank" && e.bank_id === bankId,
    );
  }

  return false;
}

/**
 * Check if a user has the required roles.
 *
 * @param userEntitlements - List of entitlements the user has
 * @param requiredRoles - List of roles to check
 * @param currentBankId - The currently selected bank ID (for bankScoped role checks)
 * @param requirementType - "OR" (default): user needs at least one; "AND": user needs all
 * @param jitEnabled - Whether Just In Time entitlements are enabled on this OBP instance
 * @returns RoleCheckResult with missing and present roles
 */
export function checkRoles(
  userEntitlements: UserEntitlement[],
  requiredRoles: RoleRequirement[],
  currentBankId?: string,
  requirementType: "OR" | "AND" = "OR",
  jitEnabled: boolean = false,
): RoleCheckResult {
  const missingRoles: RoleRequirement[] = [];
  const hasRoles: RoleRequirement[] = [];
  const jitRoles: RoleRequirement[] = [];

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
    } else if (jitEnabled && canJitGrant(requirement, userEntitlements, currentBankId)) {
      jitRoles.push(requirement);
    } else {
      missingRoles.push(requirement);
    }
  }

  logger.debug(
    `Role check (${requirementType}): ${hasRoles.length} present, ${jitRoles.length} JIT-covered, ${missingRoles.length} missing / ${requiredRoles.length} total`,
  );

  // JIT-covered roles count as "effectively has" for access decisions
  const effectiveHasCount = hasRoles.length + jitRoles.length;

  let hasAccess: boolean;
  if (requirementType === "AND") {
    // AND: user needs ALL required roles (explicitly or via JIT)
    hasAccess = requiredRoles.length === 0 || missingRoles.length === 0;
  } else {
    // OR: user needs at least one of the required roles (explicitly or via JIT)
    hasAccess = requiredRoles.length === 0 || effectiveHasCount > 0;
  }

  if (!hasAccess) {
    logger.warn("Missing roles:", missingRoles.map((r) => r.role).join(", "));
  }

  return {
    hasAllRoles: hasAccess,
    missingRoles: hasAccess ? [] : missingRoles,
    hasRoles,
    jitRoles,
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
