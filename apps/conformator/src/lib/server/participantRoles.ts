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
import {
	APPEAL,
	APPEAL_DECISION,
	APPROVAL,
	ASSESSMENT,
	EVIDENCE,
	PAIRING,
	RESULT,
	REVIEW_ASSIGNMENT,
	RUN,
	SCHEDULE,
	SUBMISSION,
	SYSTEM,
	WAIVER_DECISION,
	WAIVER_REQUEST
} from './entities/definitions';

const get = (e: string) => `CanGetDynamicEntityRecord_${e}`;
const create = (e: string) => `CanCreateDynamicEntityRecord_${e}`;
const update = (e: string) => `CanUpdateDynamicEntityRecord_${e}`;

/**
 * The Roles a participant's users hold at their own space: they record their systems, runs, submissions, evidence,
 * waiver requests and appeals, and read everything the regulator records about them, but never write it. Results are
 * written by the runner only.
 */
export const PARTICIPANT_MEMBER_ROLES: string[] = [
	get(SYSTEM), create(SYSTEM), update(SYSTEM),
	get(PAIRING), create(PAIRING), update(PAIRING),
	get(RUN), create(RUN),
	get(RESULT),
	get(SCHEDULE), create(SCHEDULE), update(SCHEDULE),
	get(SUBMISSION), create(SUBMISSION),
	get(EVIDENCE), create(EVIDENCE),
	get(WAIVER_REQUEST), create(WAIVER_REQUEST),
	get(APPEAL), create(APPEAL),
	get(REVIEW_ASSIGNMENT), get(ASSESSMENT), get(WAIVER_DECISION), get(APPEAL_DECISION), get(APPROVAL),
	// Evidence files: uploaded to the space and attached to evidence records.
	'CanCreateFileAtOneBank', 'CanGetFileAtOneBank'
];

/** What the regulator's staff read in a participant's space: everything. */
const REGULATOR_READ: string[] = [
	SYSTEM, PAIRING, RUN, RESULT, SCHEDULE, SUBMISSION, EVIDENCE, WAIVER_REQUEST, APPEAL,
	REVIEW_ASSIGNMENT, ASSESSMENT, WAIVER_DECISION, APPEAL_DECISION, APPROVAL
].map(get).concat('CanGetFileAtOneBank');

/** Reviewers assess tests and decide waivers and appeals. They cannot approve. */
export const REVIEWER_ROLES: string[] = [...REGULATOR_READ, create(REVIEW_ASSIGNMENT), create(ASSESSMENT), create(WAIVER_DECISION), create(APPEAL_DECISION)];

/** Approvers make the final decision. They cannot assess, so whoever reviews the evidence does not also approve it. */
export const APPROVER_ROLES: string[] = [...REGULATOR_READ, create(APPROVAL)];

/** The sets of Roles staff can give someone at a participant's space. */
export const ROLE_SETS = {
	participant: { label: "the organisation's people", roles: PARTICIPANT_MEMBER_ROLES },
	reviewer: { label: 'a reviewer for the regulator', roles: REVIEWER_ROLES },
	approver: { label: 'an approver for the regulator', roles: APPROVER_ROLES }
} as const;
export type RoleSet = keyof typeof ROLE_SETS;

/** The Role that marks a participant's space as one the User belongs to, for their list of spaces. */
export const MEMBER_MARKER_ROLE = get(SYSTEM);
