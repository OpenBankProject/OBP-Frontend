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
import { describe, it, expect } from 'vitest';
import {
	deduplicateRoles,
	pickConsentEntitlement,
	type StoredEntitlement
} from './roles';

// Catalogue stub: which roles are bank-scoped. `undefined` = unknown to the catalogue.
const CATALOGUE: Record<string, boolean> = {
	CanCreateAccount: true,
	CanCreateEntitlementAtOneBank: true,
	CanCreateEntitlementAtAnyBank: false,
	CanCreateBank: false,
	CanGetEntitlementsForAnyUserAtAnyBank: false
};
const requiresBankId = (role: string) => CATALOGUE[role];

describe('pickConsentEntitlement', () => {
	it('picks the exact (role, bank) pair when the user holds it at the requested bank', () => {
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateAccount', bank_id: 'rt.bank.b3' },
			{ role_name: 'CanCreateAccount', bank_id: 'david.bank' }
		];
		expect(pickConsentEntitlement('CanCreateAccount', 'david.bank', stored, requiresBankId)).toEqual({
			role_name: 'CanCreateAccount',
			bank_id: 'david.bank'
		});
	});

	it('NEVER falls back to a wrong-bank pair (the rt.bank.b3-instead-of-david.bank bug)', () => {
		// User holds the role at many banks — but not at the requested one.
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateAccount', bank_id: 'rt.bank.b3' },
			{ role_name: 'CanCreateAccount', bank_id: 'mufg.bnk.1' }
		];
		expect(pickConsentEntitlement('CanCreateAccount', 'david.bank', stored, requiresBankId)).toBeNull();
	});

	it('satisfies a bank-scoped role via the system-wide superseding role', () => {
		// The addEntitlement case: OneBank not held at the target bank, but AnyBank held system-wide.
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'other.bank' },
			{ role_name: 'CanCreateEntitlementAtAnyBank', bank_id: '' }
		];
		expect(
			pickConsentEntitlement('CanCreateEntitlementAtOneBank', 'david.bank', stored, requiresBankId)
		).toEqual({ role_name: 'CanCreateEntitlementAtAnyBank', bank_id: '' });
	});

	it('prefers the exact bank-scoped pair over the broader alternative', () => {
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'david.bank' },
			{ role_name: 'CanCreateEntitlementAtAnyBank', bank_id: '' }
		];
		expect(
			pickConsentEntitlement('CanCreateEntitlementAtOneBank', 'david.bank', stored, requiresBankId)
		).toEqual({ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'david.bank' });
	});

	it('pairs system-level roles with the empty bank id', () => {
		const stored: StoredEntitlement[] = [{ role_name: 'CanCreateBank', bank_id: '' }];
		expect(pickConsentEntitlement('CanCreateBank', 'david.bank', stored, requiresBankId)).toEqual({
			role_name: 'CanCreateBank',
			bank_id: ''
		});
	});

	it('does not use an inconsistent bank-scoped pair stored with an empty bank id', () => {
		// Bank-scoped role stored with bank_id '' is a data inconsistency — embedding it
		// mints a consent OBP rejects at call time, so it must not satisfy the request.
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: '' }
		];
		expect(
			pickConsentEntitlement('CanCreateEntitlementAtOneBank', 'david.bank', stored, requiresBankId)
		).toBeNull();
	});

	it('accepts exact-bank and system-wide pairs for roles unknown to the catalogue (dynamic roles)', () => {
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateDynamicEntity_training_progress', bank_id: '' }
		];
		expect(
			pickConsentEntitlement(
				'CanCreateDynamicEntity_training_progress',
				'david.bank',
				stored,
				requiresBankId
			)
		).toEqual({ role_name: 'CanCreateDynamicEntity_training_progress', bank_id: '' });
	});

	it('returns null when the user holds nothing relevant', () => {
		expect(pickConsentEntitlement('CanCreateAccount', 'david.bank', [], requiresBankId)).toBeNull();
	});
});

describe('deduplicateRoles', () => {
	it('collapses a role superseded by another in the same list', () => {
		expect(
			deduplicateRoles(['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'])
		).toEqual(['CanCreateEntitlementAtAnyBank']);
	});
});

describe('selectConsentEntitlements', () => {
	const requiresBankId = (r: string) => CATALOGUE[r];

	it('addEntitlement: OneBank held at the target bank satisfies the OneBank|AnyBank alternatives', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const stored: StoredEntitlement[] = [{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }];
		const out = selectConsentEntitlements(
			['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'],
			'friday.bank',
			stored,
			requiresBankId
		);
		expect(out.unsatisfiable).toEqual([]);
		expect(out.entitlements).toEqual([{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }]);
	});

	it('addEntitlement: AnyBank held system-wide is never embedded (OBP-35033) — reported as missing', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const stored: StoredEntitlement[] = [{ role_name: 'CanCreateEntitlementAtAnyBank', bank_id: '' }];
		const out = selectConsentEntitlements(
			['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'],
			'friday.bank',
			stored,
			requiresBankId
		);
		expect(out.entitlements).toEqual([]);
		expect(out.unsatisfiable).toEqual([
			'CanCreateEntitlementAtOneBank at bank friday.bank',
			'CanCreateEntitlementAtAnyBank'
		]);
	});

	it('OneBank at a different bank satisfies nothing — names the bank', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const stored: StoredEntitlement[] = [{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'other.bank' }];
		const out = selectConsentEntitlements(
			['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'],
			'friday.bank',
			stored,
			requiresBankId
		);
		expect(out.entitlements).toEqual([]);
		expect(out.unsatisfiable).toEqual([
			'CanCreateEntitlementAtOneBank at bank friday.bank',
			'CanCreateEntitlementAtAnyBank'
		]);
	});

	it('roles outside a chain must all be satisfied', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const stored: StoredEntitlement[] = [{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }];
		const out = selectConsentEntitlements(
			['CanCreateEntitlementAtOneBank', 'CanCreateAccount'],
			'friday.bank',
			stored,
			requiresBankId
		);
		expect(out.entitlements).toEqual([{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }]);
		expect(out.unsatisfiable).toEqual(['CanCreateAccount at bank friday.bank']);
	});
});

describe('narrowestRoles', () => {
	it('keeps the narrow role of a chain and drops its superseder', async () => {
		const { narrowestRoles } = await import('./roles');
		expect(narrowestRoles(['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'])).toEqual([
			'CanCreateEntitlementAtOneBank'
		]);
		expect(narrowestRoles(['CanCreateEntitlementAtAnyBank', 'CanCreateEntitlementAtOneBank'])).toEqual([
			'CanCreateEntitlementAtOneBank'
		]);
	});
	it('leaves unrelated roles and lone broad roles alone', async () => {
		const { narrowestRoles } = await import('./roles');
		expect(narrowestRoles(['CanCreateEntitlementAtAnyBank', 'CanCreateAccount', 'CanCreateAccount'])).toEqual([
			'CanCreateEntitlementAtAnyBank',
			'CanCreateAccount'
		]);
	});
});

describe('forbiddenConsentRoles', () => {
	it('picks out only the system-wide granting role — the bank-scoped one is allowed', async () => {
		const { forbiddenConsentRoles } = await import('./roles');
		expect(
			forbiddenConsentRoles(['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank', 'CanCreateEntitlementAtAnyBank', 'CanGetBank'])
		).toEqual(['CanCreateEntitlementAtAnyBank']);
		expect(forbiddenConsentRoles(['CanGetBank'])).toEqual([]);
	});
});

describe('selectConsentEntitlements least privilege', () => {
	const requiresBankId = (r: string) => CATALOGUE[r];
	it('embeds only the bank-scoped pair when the user holds both OneBank@bank and AnyBank', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const stored: StoredEntitlement[] = [
			{ role_name: 'CanCreateEntitlementAtAnyBank', bank_id: '' },
			{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }
		];
		for (const order of [
			['CanCreateEntitlementAtOneBank', 'CanCreateEntitlementAtAnyBank'],
			['CanCreateEntitlementAtAnyBank', 'CanCreateEntitlementAtOneBank']
		]) {
			const out = selectConsentEntitlements(order, 'friday.bank', stored, requiresBankId);
			expect(out.unsatisfiable).toEqual([]);
			expect(out.entitlements).toEqual([{ role_name: 'CanCreateEntitlementAtOneBank', bank_id: 'friday.bank' }]);
		}
	});
});

describe('selectConsentEntitlements unknown roles', () => {
	const requiresBankId = (r: string) => CATALOGUE[r];
	it('flags a role the catalogue does not know as unknown (an invented role name)', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const out = selectConsentEntitlements(['CanCreateAnyEntitlementAtAnyBank'], 'friday.bank', [], requiresBankId);
		expect(out.entitlements).toEqual([]);
		expect(out.unsatisfiable).toEqual(['CanCreateAnyEntitlementAtAnyBank at bank friday.bank']);
		expect(out.unknown).toEqual(['CanCreateAnyEntitlementAtAnyBank']);
	});
	it('does not call a known-but-unheld role unknown', async () => {
		const { selectConsentEntitlements } = await import('./roles');
		const out = selectConsentEntitlements(['CanCreateAccount'], 'friday.bank', [], requiresBankId);
		expect(out.unknown).toEqual([]);
	});
});
