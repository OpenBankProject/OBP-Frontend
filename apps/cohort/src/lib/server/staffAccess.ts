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
import { obpRequests } from './obp';
import { cohortFormsSpace, cohortSpace } from './space';
import { apiManagerUrl } from './appDirectory';
import { isAnswersRole } from './forms';
import { ANNOUNCEMENT, APPLICATION, DEMO_GUEST, DEMO_SLOT, EMAIL_SETTING, PITCH_FEEDBACK, ATTENDANCE, CALL, FORM, MILESTONE, MILESTONE_REPORT, MILESTONE_REVIEW, OPEY_CONVERSATION, PROGRAMME, REVIEW, REVIEW_ASSIGNMENT, PARTICIPANT, REVIEWER, REVIEWER_DECISION, RUBRIC_CRITERION, REMINDER, SCREENING_DECISION, SESSION, SESSION_BOOKING, STAGE_CHANGE } from './entities/definitions';

/** A Role staff need, the i18n key saying what it is for, and where: Cohort's space, the forms space, or system-wide. */
export interface StaffRole {
	role_name: string;
	purpose: string;
	space?: 'forms' | 'system';
}

/** The Roles Cohort's staff pages use. Add a line here when a staff page starts needing a new one. */
export const STAFF_ROLES: StaffRole[] = [
	{ role_name: `CanCreateDynamicEntityRecord_${PROGRAMME}`, purpose: 'access_purpose_create_programme' },
	{ role_name: `CanUpdateDynamicEntityRecord_${PROGRAMME}`, purpose: 'access_purpose_update_programme' },
	{ role_name: `CanCreateDynamicEntityRecord_${CALL}`, purpose: 'access_purpose_create_call' },
	{ role_name: `CanUpdateDynamicEntityRecord_${CALL}`, purpose: 'access_purpose_update_call' },
	{ role_name: `CanGetDynamicEntityRecord_${APPLICATION}`, purpose: 'access_purpose_read_applications' },
	{ role_name: `CanCreateDynamicEntityRecord_${SCREENING_DECISION}`, purpose: 'access_purpose_decide' },
	{ role_name: `CanGetDynamicEntityRecord_${SCREENING_DECISION}`, purpose: 'access_purpose_read_decisions' },
	{ role_name: `CanCreateDynamicEntityRecord_${RUBRIC_CRITERION}`, purpose: 'access_purpose_edit_rubric' },
	{ role_name: `CanGetDynamicEntityRecord_${REVIEWER}`, purpose: 'access_purpose_read_reviewers' },
	{ role_name: `CanCreateDynamicEntityRecord_${REVIEWER_DECISION}`, purpose: 'access_purpose_accept_reviewers' },
	{ role_name: `CanGetDynamicEntityRecord_${REVIEWER_DECISION}`, purpose: 'access_purpose_read_reviewer_decisions' },
	{ role_name: `CanCreateDynamicEntityRecord_${REVIEW_ASSIGNMENT}`, purpose: 'access_purpose_assign_reviewers' },
	{ role_name: `CanGetDynamicEntityRecord_${REVIEW_ASSIGNMENT}`, purpose: 'access_purpose_read_assignments' },
	{ role_name: `CanGetDynamicEntityRecord_${REVIEW}`, purpose: 'access_purpose_read_reviews' },
	{ role_name: `CanGetDynamicEntityRecord_${PARTICIPANT}`, purpose: 'access_purpose_read_participants' },
	{ role_name: `CanCreateDynamicEntityRecord_${PARTICIPANT}`, purpose: 'access_purpose_onboard' },
	{ role_name: `CanUpdateDynamicEntityRecord_${PARTICIPANT}`, purpose: 'access_purpose_advance_stage' },
	{ role_name: `CanCreateDynamicEntityRecord_${STAGE_CHANGE}`, purpose: 'access_purpose_record_stage' },
	{ role_name: `CanGetDynamicEntityRecord_${REMINDER}`, purpose: 'access_purpose_read_reminders' },
	{ role_name: `CanCreateDynamicEntityRecord_${SESSION}`, purpose: 'access_purpose_create_sessions' },
	{ role_name: `CanGetDynamicEntityRecord_${SESSION}`, purpose: 'access_purpose_read_sessions' },
	{ role_name: `CanGetDynamicEntityRecord_${SESSION_BOOKING}`, purpose: 'access_purpose_read_bookings' },
	{ role_name: `CanCreateDynamicEntityRecord_${ATTENDANCE}`, purpose: 'access_purpose_record_attendance' },
	{ role_name: `CanGetDynamicEntityRecord_${ATTENDANCE}`, purpose: 'access_purpose_read_attendance' },
	{ role_name: `CanCreateDynamicEntityRecord_${FORM}`, purpose: 'access_purpose_create_forms' },
	{ role_name: `CanUpdateDynamicEntityRecord_${FORM}`, purpose: 'access_purpose_edit_forms' },
	{ role_name: 'CanCreateDynamicEntityDefinition', purpose: 'access_purpose_publish_forms', space: 'forms' },
	{ role_name: 'CanUpdateDynamicEntityDefinition', purpose: 'access_purpose_grow_forms', space: 'forms' },
	{ role_name: `CanCreateDynamicEntityRecord_${MILESTONE}`, purpose: 'access_purpose_define_milestones' },
	{ role_name: `CanGetDynamicEntityRecord_${MILESTONE_REPORT}`, purpose: 'access_purpose_read_milestone_reports' },
	{ role_name: `CanCreateDynamicEntityRecord_${MILESTONE_REVIEW}`, purpose: 'access_purpose_review_milestones' },
	{ role_name: `CanGetDynamicEntityRecord_${MILESTONE_REVIEW}`, purpose: 'access_purpose_read_milestone_reviews' },
	{ role_name: 'CanGetFileAtOneBank', purpose: 'access_purpose_read_files' },
	{ role_name: `CanGetDynamicEntityRecord_${OPEY_CONVERSATION}`, purpose: 'access_purpose_read_conversations' },
	{ role_name: 'CanUpdateFileScanStatusAtOneBank', purpose: 'access_purpose_scan_files' },
	{ role_name: `CanCreateDynamicEntityRecord_${ANNOUNCEMENT}`, purpose: 'access_purpose_announce' },
	{ role_name: `CanDeleteDynamicEntityRecord_${ANNOUNCEMENT}`, purpose: 'access_purpose_remove_announcements' },
	{ role_name: `CanCreateDynamicEntityRecord_${EMAIL_SETTING}`, purpose: 'access_purpose_email_settings' },
	{ role_name: `CanUpdateDynamicEntityRecord_${EMAIL_SETTING}`, purpose: 'access_purpose_email_settings' },
	{ role_name: 'CanGetCustomersAtOneBank', purpose: 'access_purpose_read_organisations' },
	{ role_name: 'CanCreateCustomer', purpose: 'access_purpose_create_organisations' },
	{ role_name: 'CanCreateCustomerAttributeAtOneBank', purpose: 'access_purpose_create_organisations' },
	{ role_name: 'CanGetUserCustomerLink', purpose: 'access_purpose_read_members' },
	{ role_name: 'CanCreateUserCustomerLink', purpose: 'access_purpose_manage_members' },
	{ role_name: 'CanDeleteUserCustomerLink', purpose: 'access_purpose_manage_members' },
	{ role_name: 'CanGetAnyUser', purpose: 'access_purpose_find_users', space: 'system' },
	{ role_name: `CanCreateDynamicEntityRecord_${DEMO_SLOT}`, purpose: 'access_purpose_demo_slots' },
	{ role_name: `CanDeleteDynamicEntityRecord_${DEMO_SLOT}`, purpose: 'access_purpose_demo_slots' },
	{ role_name: `CanGetDynamicEntityRecord_${DEMO_GUEST}`, purpose: 'access_purpose_demo_guests' },
	{ role_name: `CanCreateDynamicEntityRecord_${DEMO_GUEST}`, purpose: 'access_purpose_demo_guests' },
	{ role_name: `CanUpdateDynamicEntityRecord_${DEMO_GUEST}`, purpose: 'access_purpose_demo_guests' },
	{ role_name: `CanGetDynamicEntityRecord_${PITCH_FEEDBACK}`, purpose: 'access_purpose_pitch_feedback' },
	{ role_name: `CanCreateDynamicEntityRecord_${PITCH_FEEDBACK}`, purpose: 'access_purpose_pitch_feedback' },
	{ role_name: 'CanGetRetentionPolicies', purpose: 'access_purpose_retention_read' },
	{ role_name: 'CanManageRetentionPolicy', purpose: 'access_purpose_retention_manage' },
	{ role_name: 'CanRunRetentionPolicy', purpose: 'access_purpose_retention_run' },
	{ role_name: 'CanApproveRetentionRun', purpose: 'access_purpose_retention_approve' },
	{ role_name: 'CanGetRetentionRuns', purpose: 'access_purpose_retention_read' }
];

/** A staff Role, or the Get Role on a published form's answers (one per form, so not listed above). */
export function isStaffRole(roleName: string): boolean {
	return STAFF_ROLES.some((r) => r.role_name === roleName) || isAnswersRole(roleName);
}

/** The bank id a staff Role is held at: the forms space for the definition Roles and the Roles on answers. */
export function spaceOfRole(roleName: string): string {
	if (STAFF_ROLES.some((r) => r.role_name === roleName && r.space === 'system')) return '';
	const forms = isAnswersRole(roleName) || STAFF_ROLES.some((r) => r.role_name === roleName && r.space === 'forms');
	return forms ? cohortFormsSpace() : cohortSpace();
}

interface Grant {
	role_name: string;
	bank_id: string;
}

/**
 * Each staff Role at its space: held, requested (an entitlement request is waiting), or neither. Reads the
 * User's Roles from OBP rather than the session, so a Role granted since login shows at once. `extra` adds Roles a
 * page needs beyond the list, such as the Get Role on a form's answers.
 */
export async function staffAccess(token: string, extra: StaffRole[] = []) {
	const space = cohortSpace();
	const [user, requests, manager] = await Promise.all([
		obpRequests.get('/obp/v5.1.0/users/current', token),
		obpRequests.get('/obp/v5.1.0/my/entitlement-requests', token).catch(() => ({ entitlement_requests: [] })),
		apiManagerUrl()
	]);
	const held: Grant[] = user?.entitlements?.list ?? [];
	const requested: Grant[] = requests?.entitlement_requests ?? [];
	const at = (list: Grant[], role: string) => list.some((g) => g.role_name === role && g.bank_id === spaceOfRole(role));
	return {
		user,
		space,
		roles: [...STAFF_ROLES, ...extra].map((r) => ({
			...r,
			bank_id: spaceOfRole(r.role_name),
			held: at(held, r.role_name),
			requested: at(requested, r.role_name)
		})),
		entitlementRequestsUrl: manager ? `${manager}/rbac/entitlement-requests` : null
	};
}

/**
 * The staff Roles the User holds at their spaces, read from OBP-API (not the session, so a new grant counts at once).
 * Holding any of them makes the User staff for the menu and the staff pages; the data on those pages is still
 * protected by each Role, which OBP-API checks.
 */
export async function staffRolesHeld(token: string): Promise<string[]> {
	const user = await obpRequests.get('/obp/v5.1.0/users/current', token);
	const held: Grant[] = user?.entitlements?.list ?? [];
	return STAFF_ROLES.filter((r) => held.some((g) => g.role_name === r.role_name && g.bank_id === spaceOfRole(r.role_name))).map((r) => r.role_name);
}

/** Ask for a staff Role at its space; an administrator accepts it in the API Manager. */
export async function requestStaffRole(roleName: string, token: string): Promise<void> {
	await obpRequests.post('/obp/v6.0.0/entitlement-requests', { bank_id: spaceOfRole(roleName), role_name: roleName }, token);
}
