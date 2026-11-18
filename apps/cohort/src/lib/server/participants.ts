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
import { createLogger } from '@obp/shared/utils';
import { riskOf, type RiskLevel } from '$lib/dashboard';
import { nowUtc } from '$lib/screening';
import { canSeeParticipant, type MyOrganisation } from '$lib/teams';
import { requestApplicationAccessToken } from './applicationToken';
import { CALL, PARTICIPANT } from './entities/definitions';
import { obpRequests } from './obp';
import { createRecord, getRecord, idOf, listRecords, updateRecord, type CohortRecord } from './records';
import { cohortSpace } from './space';
import { myOrganisations } from './teams';

const logger = createLogger('CohortParticipants');

/**
 * Onboarding. When staff accept an application at evaluation, the startup becomes a participant of the call's
 * programme, created with the staff member's own Roles (Get and Create on cohort_participant): a staff action is never
 * done with Cohort's Scopes. What the startup does itself runs as Cohort, narrowed to its own records: seeing its
 * participation, choosing its team, and registering its company (a CORPORATE Customer, the applicant linked to it, and
 * its customer_id on the participant, with Cohort's Get and Update Scopes).
 *
 * A startup is a team: an OBP Organisation named in the participant's organisation_id. A User sees a participation if
 * they are a member of its team (read from /my/organisations with their own token), or, only while it has no team yet,
 * if they are its applicant (user_id).
 */

export interface Participant {
	id: string;
	programme_id: string;
	call_id: string;
	application_id: string;
	user_id: string;
	startup_name: string;
	customer_id: string;
	organisation_id: string;
	stage: string;
	status: string;
	joined_at: string;
	graduated_at: string;
	risk: RiskLevel;
	risk_note: string;
}

export function participantOf(record: CohortRecord): Participant {
	return {
		id: idOf(PARTICIPANT, record),
		programme_id: String(record.programme_id ?? ''),
		call_id: String(record.call_id ?? ''),
		application_id: String(record.application_id ?? ''),
		user_id: String(record.user_id ?? ''),
		startup_name: String(record.startup_name ?? ''),
		customer_id: String(record.customer_id ?? ''),
		organisation_id: String(record.organisation_id ?? ''),
		stage: String(record.stage ?? ''),
		status: String(record.status ?? ''),
		joined_at: String(record.joined_at ?? ''),
		graduated_at: String(record.graduated_at ?? ''),
		risk: riskOf(record.risk),
		risk_note: String(record.risk_note ?? '')
	};
}

async function cohortToken(): Promise<string> {
	const { token } = await requestApplicationAccessToken();
	if (!token) throw new Error('Cohort has no application token, so it cannot keep participant records.');
	return token;
}

/** Every participant, read as Cohort. */
export async function participantsAsCohort(): Promise<{ record: CohortRecord; participant: Participant }[]> {
	const records = await listRecords(PARTICIPANT, '', await cohortToken());
	return records.map((record) => ({ record, participant: participantOf(record) }));
}

/**
 * The User's Organisations, read with their own token. Empty, and logged, when OBP-API cannot give them (for example
 * before it has Organisations), so the applicant still sees a participation that has no team yet.
 */
export async function myOrganisationsOrNone(userToken: string): Promise<MyOrganisation[]> {
	try {
		return await myOrganisations(userToken);
	} catch (err) {
		logger.warn("Cohort could not read the User's Organisations:", err);
		return [];
	}
}

/** The participations the User may see, with their records, read as Cohort and narrowed to the User. */
async function visibleParticipants(userId: string, userToken: string) {
	const [all, organisations] = await Promise.all([participantsAsCohort(), myOrganisationsOrNone(userToken)]);
	const organisationIds = organisations.map((organisation) => organisation.organisation_id);
	return all.filter((p) => canSeeParticipant(p.participant, userId, organisationIds));
}

/**
 * The programmes the User's startup takes part in: those of the teams they belong to, and those they applied for that
 * have no team yet. Empty, and logged, when Cohort cannot read them.
 */
export async function participantsOfUser(userId: string, userToken: string): Promise<Participant[]> {
	try {
		return (await visibleParticipants(userId, userToken)).map((p) => p.participant);
	} catch (err) {
		logger.warn('Cohort could not read participants (does it hold the Scopes shown on /staff/setup?):', err);
		return [];
	}
}

/** A participant record for a PUT, which replaces the record: its fields without its own id field or empty values. */
function replacementBody(record: CohortRecord, changes: CohortRecord): CohortRecord {
	return Object.fromEntries(
		Object.entries({ ...record, ...changes }).filter(
			([key, value]) => key !== `${PARTICIPANT}_id` && value !== '' && value !== null && value !== undefined
		)
	);
}

/**
 * Make an accepted application's startup a participant of the call's programme, unless it already is one, with the
 * accepting staff member's token. Returns the participant.
 */
export async function onboardAccepted(args: {
	applicationId: string;
	application: CohortRecord;
	applicantUserId: string;
	acceptedBy: string;
	staffToken: string;
}): Promise<Participant> {
	const existing = (await listRecords(PARTICIPANT, '', args.staffToken)).find((r) => r.application_id === args.applicationId);
	if (existing) return participantOf(existing);
	const call = await getRecord(CALL, 'public', String(args.application.call_id));
	const record: CohortRecord = {
		programme_id: String(call.programme_id ?? ''),
		call_id: String(args.application.call_id ?? ''),
		application_id: args.applicationId,
		user_id: args.applicantUserId,
		startup_name: String(args.application.startup_name ?? ''),
		stage: 'onboarded',
		status: 'active',
		joined_at: nowUtc(),
		accepted_by_username: args.acceptedBy
	};
	const created = await createRecord(PARTICIPANT, '', Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '')), args.staffToken);
	return participantOf(created);
}

/**
 * Register the startup's company: a CORPORATE Customer of the space (kyc_status false), the User linked to it, and its
 * customer_id on the participant. Anyone who can see the participation may do this, and only once.
 */
export async function registerCompany(
	participantId: string,
	userId: string,
	userToken: string,
	details: { legal_name: string; mobile_phone_number: string; email: string }
): Promise<string> {
	const found = (await visibleParticipants(userId, userToken)).find((p) => p.participant.id === participantId);
	if (!found) throw new Error('This is not your programme.');
	if (found.participant.customer_id) return found.participant.customer_id;
	const token = await cohortToken();
	const space = encodeURIComponent(cohortSpace());
	const created = await obpRequests.post(
		`/obp/v6.0.0/banks/${space}/customers`,
		{ ...details, customer_type: 'CORPORATE', kyc_status: false },
		token
	);
	const customerId = String(created?.customer_id ?? '');
	await obpRequests.post(`/obp/v5.1.0/banks/${space}/user_customer_links`, { user_id: userId, customer_id: customerId }, token);
	await updateRecord(PARTICIPANT, '', participantId, replacementBody(found.record, { customer_id: customerId }), token);
	return customerId;
}

/**
 * Record the startup's team on the participant, with Cohort's Update Scope. Only the applicant may, only while the
 * participation has no team, and only with an active team the applicant is an admin of (so they can manage who is in
 * it). Staff correct a team on the Participants page with their own Roles. After this, the team's members see the
 * participation and the applicant sees it as a member.
 */
export async function recordTeam(participantId: string, userId: string, userToken: string, organisationId: string): Promise<void> {
	const [all, organisations] = await Promise.all([participantsAsCohort(), myOrganisationsOrNone(userToken)]);
	const found = all.find((p) => p.participant.id === participantId && p.participant.user_id === userId && !p.participant.organisation_id);
	if (!found) throw new Error('This is not your programme, or it already has a team.');
	const team = organisations.find(
		(organisation) => organisation.organisation_id === organisationId && organisation.status === 'active' && organisation.member_role === 'admin'
	);
	if (!team) throw new Error('You are not an admin of that team.');
	await updateRecord(PARTICIPANT, '', participantId, replacementBody(found.record, { organisation_id: organisationId }), await cohortToken());
}
