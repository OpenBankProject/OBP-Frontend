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
import { fail } from '@sveltejs/kit';
import { isOrganisationKind, ORGANISATION_ATTRIBUTES, organisationOfCustomer, organisationsQuery, type OrganisationKind } from '$lib/organisations';
import { PARTICIPANT } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { obpRequests } from '$lib/server/obp';
import { idOf, listRecords, userToken } from '$lib/server/records';
import { cohortSpace } from '$lib/server/space';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

/**
 * Organisations: the network's banks, universities, regulators and partners, and the startups whose company is
 * registered (from the participants). Each is a CORPORATE Customer of Cohort's space with its people linked by User
 * Customer Links; staff-created ones carry their kind, Arabic name and website as Customer Attributes. Everything runs
 * with the staff member's own Roles.
 */

const ROLES = {
	read: 'CanGetCustomersAtOneBank',
	customer: 'CanCreateCustomer',
	attribute: 'CanCreateCustomerAttributeAtOneBank',
	members: 'CanGetUserCustomerLink',
	link: 'CanCreateUserCustomerLink',
	unlink: 'CanDeleteUserCustomerLink',
	users: 'CanGetAnyUser'
};

const space = () => encodeURIComponent(cohortSpace());

interface Member {
	link_id: string;
	user_id: string;
	username: string;
}

/** The Users linked to a Customer, with their usernames where the staff member may look Users up. */
async function membersOf(customerId: string, token: string): Promise<Member[]> {
	const response = await obpRequests.get(`/obp/v4.0.0/banks/${space()}/user_customer_links/customers/${encodeURIComponent(customerId)}`, token);
	const links: Record<string, unknown>[] = response?.user_customer_links ?? [];
	return Promise.all(
		links.map(async (l) => {
			const userId = String(l.user_id ?? '');
			const user = await obpRequests.get(`/obp/v3.0.0/users/user_id/${encodeURIComponent(userId)}`, token).catch(() => null);
			return { link_id: String(l.user_customer_link_id ?? ''), user_id: userId, username: String(user?.username ?? '') };
		})
	);
}

export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const roles = access?.roles ?? [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const base = { space: access?.space ?? '', entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null, lacking };
	const [customers, participants] = await Promise.all([
		lacking.read
			? Promise.resolve([])
			: obpRequests
					.get(`/obp/v4.0.0/banks/${space()}/customers?${organisationsQuery()}`, token)
					.then((r) => (r?.customers ?? []) as Parameters<typeof organisationOfCustomer>[0][])
					.catch(() => []),
		listRecords(PARTICIPANT, '', token).catch(() => [])
	]);
	const organisations: { id: string; name: string; name_ar: string; kind: OrganisationKind; customer_id: string; website: string }[] = [
		...customers.map(organisationOfCustomer),
		// A startup's registered company is an organisation too, once; listed from its participation.
		...[...new Map(participants.filter((p) => p.customer_id).map((p) => [String(p.customer_id), p])).values()].map((p) => ({
			id: `participant:${idOf(PARTICIPANT, p)}`,
			name: String(p.startup_name ?? ''),
			name_ar: '',
			kind: 'startup' as const,
			customer_id: String(p.customer_id),
			website: ''
		}))
	];
	const withMembers = await Promise.all(
		organisations.map(async (o) => ({
			...o,
			members: lacking.members ? null : await membersOf(o.customer_id, token).catch(() => null)
		}))
	);
	return { ...base, organisations: withMembers.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)) };
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	/** A new organisation: its CORPORATE Customer at the space, then its kind, Arabic name and website as attributes. */
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const token = userToken(locals)!;
		const kind = str(form, 'kind');
		const details = { name: str(form, 'name'), email: str(form, 'email'), mobile_phone_number: str(form, 'mobile_phone_number') };
		if (!details.name || !details.email || !details.mobile_phone_number || !isOrganisationKind(kind) || kind === 'startup') {
			return fail(400, { form: 'create', error: 'organisation_missing' });
		}
		return write(
			'create',
			async () => {
				const customer = await obpRequests.post(
					`/obp/v6.0.0/banks/${space()}/customers`,
					{ legal_name: details.name, email: details.email, mobile_phone_number: details.mobile_phone_number, customer_type: 'CORPORATE', kyc_status: false },
					token
				);
				const customerId = encodeURIComponent(String(customer?.customer_id ?? ''));
				const attributes = { [ORGANISATION_ATTRIBUTES.kind]: kind, [ORGANISATION_ATTRIBUTES.name_ar]: str(form, 'name_ar'), [ORGANISATION_ATTRIBUTES.website]: str(form, 'website') };
				for (const [name, value] of Object.entries(attributes).filter(([, v]) => v !== '')) {
					await obpRequests.post(`/obp/v4.0.0/banks/${space()}/customers/${customerId}/attribute`, { name, type: 'STRING', value }, token);
				}
			},
			{ created: true }
		);
	},
	/** Link a User, found by username, to an organisation's Customer. */
	addMember: async ({ locals, request }) => {
		const form = await request.formData();
		const token = userToken(locals)!;
		const customerId = str(form, 'customer_id');
		const username = str(form, 'username');
		if (!customerId || !username) return fail(400, { form: 'member', error: 'member_missing' });
		let userId: string;
		try {
			const user = await obpRequests.get(`/obp/v3.0.0/users/username/${encodeURIComponent(username)}`, token);
			userId = String(user?.user_id ?? '');
		} catch (err) {
			return fail(400, { form: 'member', error: `member_not_found`, detail: messageOf(err) });
		}
		if (!userId) return fail(400, { form: 'member', error: 'member_not_found' });
		return write('member', () => obpRequests.post(`/obp/v4.0.0/banks/${space()}/user_customer_links`, { user_id: userId, customer_id: customerId }, token), { added: username });
	},
	removeMember: async ({ locals, request }) => {
		const linkId = str(await request.formData(), 'link_id');
		if (!linkId) return fail(400, { form: 'member', error: 'member_missing' });
		return write('member', () => obpRequests.delete(`/obp/v4.0.0/banks/${space()}/user_customer_links/${encodeURIComponent(linkId)}`, userToken(locals)!), { removed: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
