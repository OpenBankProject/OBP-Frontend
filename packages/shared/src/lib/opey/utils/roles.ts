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
/**
 * OBP role superseding map.
 * Key   = role that OBP may report as "required"
 * Value = roles that are ALSO sufficient (broader grants)
 *
 * Source: full role list from OBP, confirmed 2026-02-17.
 * Rule:   a role with requires_bank_id=false supersedes the
 *         corresponding requires_bank_id=true variant.
 */
export const ROLE_SUPERSEDED_BY: Record<string, string[]> = {
	// AddUserToGroup
	CanAddUserToGroupAtOneBank: ['CanAddUserToGroupAtAllBanks'],
	// ATM
	CanCreateAtm: ['CanCreateAtmAtAnyBank'],
	CanCreateAtmAttribute: ['CanCreateAtmAttributeAtAnyBank'],
	CanDeleteAtm: ['CanDeleteAtmAtAnyBank'],
	CanDeleteAtmAttribute: ['CanDeleteAtmAttributeAtAnyBank'],
	CanGetAtmAttribute: ['CanGetAtmAttributeAtAnyBank'],
	CanUpdateAtm: ['CanUpdateAtmAtAnyBank'],
	CanUpdateAtmAttribute: ['CanUpdateAtmAttributeAtAnyBank'],
	// Branch
	CanCreateBranch: ['CanCreateBranchAtAnyBank'],
	CanDeleteBranch: ['CanDeleteBranchAtAnyBank'],
	// Consent
	CanGetConsentsAtOneBank: ['CanGetConsentsAtAnyBank'],
	CanUpdateConsentAccountAccessAtOneBank: ['CanUpdateConsentAccountAccessAtAnyBank'],
	CanUpdateConsentStatusAtOneBank: ['CanUpdateConsentStatusAtAnyBank'],
	CanUpdateConsentUserAtOneBank: ['CanUpdateConsentUserAtAnyBank'],
	// Counterparty
	CanCreateCounterparty: ['CanCreateCounterpartyAtAnyBank'],
	CanDeleteCounterparty: ['CanDeleteCounterpartyAtAnyBank'],
	CanGetCounterparties: ['CanGetCounterpartiesAtAnyBank'],
	CanGetCounterparty: ['CanGetCounterpartyAtAnyBank'],
	// Customer
	CanCreateCustomer: ['CanCreateCustomerAtAnyBank'],
	CanCreateCustomerAttributeAtOneBank: ['CanCreateCustomerAttributeAtAnyBank'],
	CanDeleteCustomerAttributeAtOneBank: ['CanDeleteCustomerAttributeAtAnyBank'],
	CanGetCustomerAttributeAtOneBank: ['CanGetCustomerAttributeAtAnyBank'],
	CanGetCustomerAttributesAtOneBank: ['CanGetCustomerAttributesAtAnyBank'],
	CanGetCustomersAtOneBank: ['CanGetCustomersAtAllBanks'],
	CanGetCustomersMinimalAtOneBank: ['CanGetCustomersMinimalAtAllBanks'],
	CanUpdateCustomerAttributeAtOneBank: ['CanUpdateCustomerAttributeAtAnyBank'],
	CanUpdateCustomerCreditRatingAndSource: ['CanUpdateCustomerCreditRatingAndSourceAtAnyBank'],
	// Double-entry transaction
	CanGetDoubleEntryTransactionAtOneBank: ['CanGetDoubleEntryTransactionAtAnyBank'],
	// Entitlement
	CanCreateEntitlementAtOneBank: ['CanCreateEntitlementAtAnyBank'],
	CanDeleteEntitlementAtOneBank: ['CanDeleteEntitlementAtAnyBank'],
	CanDeleteEntitlementRequestsAtOneBank: ['CanDeleteEntitlementRequestsAtAnyBank'],
	CanGetEntitlementRequestsAtOneBank: ['CanGetEntitlementRequestsAtAnyBank'],
	CanGetEntitlementsForAnyUserAtOneBank: ['CanGetEntitlementsForAnyUserAtAnyBank'],
	CanGetEntitlementsForOneBank: ['CanGetEntitlementsForAnyBank'],
	// FX Rate
	CanCreateFxRate: ['CanCreateFxRateAtAnyBank'],
	// Group
	CanCreateGroupAtOneBank: ['CanCreateGroupAtAllBanks'],
	CanDeleteGroupAtOneBank: ['CanDeleteGroupAtAllBanks'],
	CanGetGroupsAtOneBank: ['CanGetGroupsAtAllBanks'],
	CanRemoveUserFromGroupAtOneBank: ['CanRemoveUserFromGroupAtAllBanks'],
	CanUpdateGroupAtOneBank: ['CanUpdateGroupAtAllBanks'],
	// Historical transaction (the no-bank-id version is the broader one)
	CanCreateHistoricalTransactionAtBank: ['CanCreateHistoricalTransaction'],
	// Product
	CanCreateProduct: ['CanCreateProductAtAnyBank'],
	// Scope
	CanCreateScopeAtOneBank: ['CanCreateScopeAtAnyBank'],
	CanDeleteScopeAtOneBank: ['CanDeleteScopeAtAnyBank'],
	// Transaction request
	CanGetTransactionRequestAtOneBank: ['CanGetTransactionRequestAtAnyBank'],
	CanUpdateTransactionRequestStatusAtOneBank: ['CanUpdateTransactionRequestStatusAtAnyBank'],
	// User-customer link
	CanCreateUserCustomerLink: ['CanCreateUserCustomerLinkAtAnyBank'],
	CanDeleteUserCustomerLink: ['CanDeleteUserCustomerLinkAtAnyBank'],
	CanGetUserCustomerLink: ['CanGetUserCustomerLinkAtAnyBank'],
	// User group memberships
	CanGetUserGroupMembershipsAtOneBank: ['CanGetUserGroupMembershipsAtAllBanks'],
	// Agent status
	CanUpdateAgentStatusAtOneBank: ['CanUpdateAgentStatusAtAnyBank'],
	// Accounts
	CanGetAccountsHeldAtOneBank: ['CanGetAccountsHeldAtAnyBank'],
	CanGetAccountsMinimalForCustomerAtOneBank: ['CanGetAccountsMinimalForCustomerAtAnyBank'],
	// Correlated users
	CanGetCorrelatedUsersInfo: ['CanGetCorrelatedUsersInfoAtAnyBank'],
	// Firehose
	CanUseAccountFirehose: ['CanUseAccountFirehoseAtAnyBank'],
	CanUseCustomerFirehose: ['CanUseCustomerFirehoseAtAnyBank']
};

export interface RoleRequirement {
	/** The role OBP asked for. */
	role: string;
	/** Broader roles that satisfy the same requirement. */
	alternatives: string[];
}

/**
 * Enrich a required_roles list with the alternative (broader) roles that
 * would also satisfy each requirement.
 */
export function expandRoleRequirements(requiredRoles: string[]): RoleRequirement[] {
	return requiredRoles.map((role) => ({
		role,
		alternatives: ROLE_SUPERSEDED_BY[role] ?? []
	}));
}

/**
 * Given a role required by OBP and the set of role names the current user
 * holds, return the role string to include in the consent JWT.
 *
 * Preference order:
 *   1. The exact required role (if the user holds it)
 *   2. The first superseding role the user holds
 *   3. null — user holds neither; consent JWT cannot be created
 */
export function pickConsentRole(requiredRole: string, userRoles: Set<string>): string | null {
	if (userRoles.has(requiredRole)) return requiredRole;
	for (const alt of ROLE_SUPERSEDED_BY[requiredRole] ?? []) {
		if (userRoles.has(alt)) return alt;
	}
	return null;
}

export interface StoredEntitlement {
	role_name: string;
	/** Empty string for system-wide entitlements. */
	bank_id: string;
}

/**
 * Bank-aware successor to {@link pickConsentRole}: pick the exact stored
 * (role_name, bank_id) entitlement pair to embed in a consent.
 *
 * OBP executes a consent as a shadow user whose entitlements are exactly the
 * pairs embedded in the consent JWT — the caller's live entitlements are never
 * consulted at call time. Embedding a pair at the wrong bank therefore mints a
 * consent that OBP later rejects with a role error, which is strictly worse
 * than refusing up front. So: never fall back to an arbitrary stored bank.
 *
 * @param requiredRole    role OBP asked for
 * @param requestedBankId bank the operation targets ('' when not bank-scoped)
 * @param userEntitlements the user's stored entitlements (source of truth —
 *                         OBP rejects consent pairs that don't match exactly)
 * @param requiresBankId   catalogue lookup: true = bank-scoped, false =
 *                         system-level, undefined = unknown (e.g. dynamic roles)
 * @returns the pair to embed, or null when nothing the user holds authorizes
 *          the operation at the requested bank
 */
export function pickConsentEntitlement(
	requiredRole: string,
	requestedBankId: string,
	userEntitlements: StoredEntitlement[],
	requiresBankId: (role: string) => boolean | undefined
): StoredEntitlement | null {
	const candidates = [requiredRole, ...(ROLE_SUPERSEDED_BY[requiredRole] ?? [])];
	for (const candidate of candidates) {
		const stored = userEntitlements.filter((e) => e.role_name === candidate);
		if (stored.length === 0) continue;

		const needsBank = requiresBankId(candidate);

		if (needsBank === false) {
			// System-level role: the '' pair is the canonical one.
			const pair = stored.find((e) => e.bank_id === '') ?? stored[0];
			return { role_name: pair.role_name, bank_id: pair.bank_id };
		}

		// Bank-scoped (true) or unknown role: only an exact match on the
		// requested bank authorizes the call.
		if (requestedBankId !== '') {
			const exact = stored.find((e) => e.bank_id === requestedBankId);
			if (exact) return { role_name: exact.role_name, bank_id: exact.bank_id };
		}
		if (needsBank === undefined) {
			// Unknown to the catalogue (e.g. dynamic-entity roles): a system-wide
			// ('') pair may still be the right shape.
			const systemWide = stored.find((e) => e.bank_id === '');
			if (systemWide) return { role_name: systemWide.role_name, bank_id: '' };
		}
		// Otherwise keep trying broader candidates (e.g. the ...AtAnyBank variant).
	}
	return null;
}

/**
 * Remove any role from the list that is already superseded by another role
 * in the same list. Returns the minimal set needed.
 *
 * Example: ["CanCreateEntitlementAtOneBank", "CanCreateEntitlementAtAnyBank"]
 *   → ["CanCreateEntitlementAtAnyBank"]
 */
export function deduplicateRoles(roles: string[]): string[] {
	const roleSet = new Set(roles);
	return roles.filter((role) => {
		const supersedersPresent = (ROLE_SUPERSEDED_BY[role] ?? []).some((s) => roleSet.has(s));
		return !supersedersPresent;
	});
}

/**
 * Roles OBP refuses to embed in ANY consent (OBP-35033, `RolesForbiddenInConsent`).
 * A consent is a delegated agent identity; letting it carry the SYSTEM-WIDE
 * role-granting role would let an agent escalate anywhere. The bank-scoped
 * `CanCreateEntitlementAtOneBank` IS allowed (since 2026-09-02), so an agent
 * under a consent can grant roles at a bank whose one-bank role the human
 * holds — a bank's creator can delegate that to Opey. `createConsentJWT` strips
 * the forbidden role even where a create endpoint forgets to reject it.
 */
export const CONSENT_FORBIDDEN_ROLES: readonly string[] = ['CanCreateEntitlementAtAnyBank'];

export interface ConsentEntitlementSelection {
	/** Distinct (role_name, bank_id) pairs to embed in the consent body. */
	entitlements: StoredEntitlement[];
	/**
	 * Roles nothing the user holds can satisfy, as human-readable labels
	 * ("CanCreateAccount at bank x" / "CanCreateBank"). Empty means mint.
	 */
	unsatisfiable: string[];
	/**
	 * Subset of the unsatisfied roles that the OBP role catalogue does not know
	 * either — almost always a role name the agent invented (e.g.
	 * "CanCreateAnyEntitlementAtAnyBank"). Worth telling the agent explicitly so
	 * it re-checks the endpoint's real roles instead of asking for an admin.
	 */
	unknown: string[];
}

/** Two roles are in the same chain when one supersedes the other. */
function sameSupersedingChain(a: string, b: string): boolean {
	return a === b || (ROLE_SUPERSEDED_BY[a] ?? []).includes(b) || (ROLE_SUPERSEDED_BY[b] ?? []).includes(a);
}

/**
 * Turn the roles OBP-MCP reports for an endpoint into the entitlement pairs to
 * embed in a per-tool consent.
 *
 * OBP resource docs list a superseding chain as alternatives — the middleware
 * enforces "X or Y" — so the list must NOT be pre-collapsed to the broadest
 * role: a user holding only `CanCreateEntitlementAtOneBank` at the target bank
 * is fully authorised for addEntitlement even though they lack
 * `CanCreateEntitlementAtAnyBank`. Instead every role is tried, and an
 * unsatisfied role only counts as missing when no satisfied role in its chain
 * covers it. Roles outside any chain still all have to be satisfied.
 */
export function selectConsentEntitlements(
	requiredRoles: string[],
	requestedBankId: string,
	userEntitlements: StoredEntitlement[],
	requiresBankId: (role: string) => boolean | undefined
): ConsentEntitlementSelection {
	// Never embed a role OBP would reject (or silently strip) from the consent —
	// a user holding only the system-wide granting role is treated as not
	// holding it here, and the endpoint explains what to do instead.
	userEntitlements = userEntitlements.filter((e) => !CONSENT_FORBIDDEN_ROLES.includes(e.role_name));
	const satisfied: string[] = [];
	const failed: string[] = [];
	const entitlements: StoredEntitlement[] = [];
	const seenPairs = new Set<string>();

	// Narrowest first, so a bank-scoped role is tried before its system-wide
	// superseder; then skip a superseder whose narrower sibling already embedded a
	// pair. Least privilege: never put a system-wide role in a consent when the
	// bank-scoped one the user holds is enough.
	const unique = Array.from(new Set(requiredRoles));
	const ordered = [...narrowestRoles(unique), ...unique.filter((r) => !narrowestRoles(unique).includes(r))];
	for (const role of ordered) {
		if (satisfied.some((ok) => (ROLE_SUPERSEDED_BY[ok] ?? []).includes(role))) {
			satisfied.push(role); // covered by the narrower pair already embedded
			continue;
		}
		const picked = pickConsentEntitlement(role, requestedBankId, userEntitlements, requiresBankId);
		if (picked === null) {
			failed.push(role);
			continue;
		}
		satisfied.push(role);
		const key = `${picked.role_name}|${picked.bank_id}`;
		if (!seenPairs.has(key)) {
			seenPairs.add(key);
			entitlements.push(picked);
		}
	}

	const missing = failed.filter((role) => !satisfied.some((ok) => sameSupersedingChain(role, ok)));
	const unsatisfiable = missing.map((role) => {
		const bankScoped = requiresBankId(role) !== false && requestedBankId !== '';
		return bankScoped ? `${role} at bank ${requestedBankId}` : role;
	});
	const unknown = missing.filter((role) => requiresBankId(role) === undefined);

	return { entitlements, unsatisfiable, unknown };
}

/**
 * Inverse of {@link deduplicateRoles} for DISPLAY: keep the narrowest role of
 * each superseding chain, dropping any role that merely supersedes another
 * role in the list. Pairs with {@link expandRoleRequirements} so a consent card
 * shows "CanCreateEntitlementAtOneBank or CanCreateEntitlementAtAnyBank" —
 * the role the user most likely holds first, the broader one as the "or".
 *
 * Example: ["CanCreateEntitlementAtOneBank", "CanCreateEntitlementAtAnyBank"]
 *   → ["CanCreateEntitlementAtOneBank"]
 */
export function narrowestRoles(roles: string[]): string[] {
	const unique = Array.from(new Set(roles));
	return unique.filter(
		(role) => !unique.some((other) => other !== role && (ROLE_SUPERSEDED_BY[other] ?? []).includes(role))
	);
}


/** The subset of `roles` OBP will not allow in a consent. */
export function forbiddenConsentRoles(roles: string[]): string[] {
	return Array.from(new Set(roles.filter((r) => CONSENT_FORBIDDEN_ROLES.includes(r))));
}
