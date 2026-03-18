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
