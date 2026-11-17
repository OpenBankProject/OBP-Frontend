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
import { fail, redirect } from '@sveltejs/kit';
import { isOneOf, PARTICIPANT_CATEGORIES } from '@obp/shared/conformator';
import { createRecord, idOf, listRecords, userToken, type EntityRecord } from '$lib/server/records';
import { PARTICIPANT, PARTICIPANT_DECISION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { fields } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { centralSpace, isSpaceId, proposedParticipantSpace } from '$lib/server/space';
import { currentStage } from '$lib/participants';
import { CREATE_ORGANISATION_ROLE, createOrganisation, userIdByUsername, type Organisation } from '$lib/server/organisations';
import type { Actions, PageServerLoad } from './$types';

const GET_ROLE = `CanGetDynamicEntityRecord_${PARTICIPANT}`;
const CREATE_ROLE = `CanCreateDynamicEntityRecord_${PARTICIPANT}`;
const GET_DECISIONS_ROLE = `CanGetDynamicEntityRecord_${PARTICIPANT_DECISION}`;

export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const can = await roleCheck(token);
	let participants: EntityRecord[] = [];
	let problem: string | null = null;
	if (can(GET_ROLE)) {
		try {
			const [list, decisions] = await Promise.all([
				listRecords(PARTICIPANT, token),
				can(GET_DECISIONS_ROLE) ? listRecords(PARTICIPANT_DECISION, token) : Promise.resolve([])
			]);
			participants = list
				.map(({ record }): EntityRecord => {
					const own = decisions
						.filter((d) => d.record.participant_id === idOf(PARTICIPANT, record))
						.map((d): EntityRecord => ({ ...d.record, created_at: d.metadata.created?.at }));
					return { ...record, stage: can(GET_DECISIONS_ROLE) ? currentStage(own) : undefined };
				})
				.sort((a, b) => String(a.legal_name).localeCompare(String(b.legal_name)));
		} catch (err) {
			problem = messageOf(err);
		}
	}
	return {
		participants,
		problem,
		categories: PARTICIPANT_CATEGORIES,
		can: {
			read: can(GET_ROLE),
			// Registering also creates the participant's Organisation, naming its first admin found by username.
			create: can(CREATE_ROLE) && can(CREATE_ORGANISATION_ROLE) && can('CanGetAnyUser', ''),
			readStages: can(GET_DECISIONS_ROLE)
		},
		roles: { read: GET_ROLE, create: [CREATE_ROLE, CREATE_ORGANISATION_ROLE], findUser: 'CanGetAnyUser', readStages: GET_DECISIONS_ROLE },
		space: centralSpace()
	};
};

export const actions: Actions = {
	register: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const { text, problems } = fields(form);
		const legalName = text('legal_name', 'The legal name', { required: true, max: 255 });
		const adminUsername = text('admin_username', "The username of the Organisation's first admin", { required: true, max: 100 });
		const body = {
			legal_name: legalName,
			category: text('category', 'The category', { required: true }),
			space_id: text('space_id', 'The space id', { max: 36 }).toLowerCase() || proposedParticipantSpace(legalName),
			is_reference: form.get('is_reference') === 'on'
		};
		const values = { ...body, admin_username: adminUsername };
		if (!isOneOf(PARTICIPANT_CATEGORIES, body.category)) problems.push('Choose the kind of organisation.');
		if (!isSpaceId(body.space_id)) problems.push('The space id may use only lower-case letters, digits and hyphens, up to 36 characters.');
		if (body.space_id === centralSpace()) problems.push('A participant cannot use the central space.');
		if (problems.length) return fail(400, { problems, values });

		let adminUserId: string;
		try {
			adminUserId = await userIdByUsername(adminUsername, token);
		} catch (err) {
			return fail(400, { problems: [`The User ${adminUsername} could not be found: ${messageOf(err)}`], values });
		}
		let organisation: Organisation;
		try {
			organisation = await createOrganisation(legalName, adminUserId, token);
		} catch (err) {
			return fail(400, { problems: [`The Organisation could not be created: ${messageOf(err)}`], values });
		}
		let created;
		try {
			created = await createRecord(PARTICIPANT, { ...body, organisation_id: organisation.organisation_id }, token);
		} catch (err) {
			return fail(400, {
				problems: [`The Organisation ${organisation.organisation_id} was created, but the participant could not be registered: ${messageOf(err)}`],
				values
			});
		}
		redirect(303, `/staff/participants/${encodeURIComponent(idOf(PARTICIPANT, created))}`);
	}
};
