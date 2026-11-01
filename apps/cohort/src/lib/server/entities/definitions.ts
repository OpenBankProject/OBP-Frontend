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
import { PORTAL_OPEY_CONVERSATION_ENTITY } from '@obp/shared/opey';
import type { SystemDynamicEntityDefinition } from '@obp/shared/server/obp';

/**
 * The Dynamic Entities Cohort keeps in its space. Cohort creates them at startup and adds new properties
 * to them; properties are never renamed, retyped or removed (see DESIGN_DECISIONS.md).
 */

export const PROGRAMME = 'cohort_programme';
export const CALL = 'cohort_call';
export const APPLICATION = 'cohort_application';
export const SCREENING_DECISION = 'cohort_screening_decision';
export const OPEY_CONVERSATION = 'cohort_opey_conversation';
export const RUBRIC_CRITERION = 'cohort_rubric_criterion';
export const REVIEWER = 'cohort_reviewer';
export const REVIEWER_DECISION = 'cohort_reviewer_decision';
export const REVIEW_ASSIGNMENT = 'cohort_review_assignment';
export const REVIEW = 'cohort_review';

const text = (example: string, description: string, maxLength = 255, minLength = 0) => ({
	type: 'string',
	...(minLength ? { minLength } : {}),
	maxLength,
	example,
	description
});

/** A programme the hub runs, e.g. an incubation or acceleration track. Public: the website lists them. */
export const programmeEntity: SystemDynamicEntityDefinition = {
	entity_name: PROGRAMME,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A programme of the innovation hub, e.g. an incubation or acceleration track.',
		required: ['name', 'status'],
		properties: {
			name: text('Fintech Acceleration 2027', 'The name of the programme.', 255, 1),
			description: text('A six-month programme for fintech startups.', 'What the programme offers.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			starts_on: text('2027-01-15', 'First day (YYYY-MM-DD).', 10),
			ends_on: text('2027-07-15', 'Last day (YYYY-MM-DD).', 10)
		}
	}
};

/** A call for applications to a programme. Public: applicants find open calls on the website. */
export const callEntity: SystemDynamicEntityDefinition = {
	entity_name: CALL,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A call for applications to a programme.',
		required: ['programme_id', 'title', 'status'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme this call is for.', 36, 1),
			title: text('Cohort 1 - spring 2027', 'The title applicants see.', 255, 1),
			description: text('Applications are open to fintech startups.', 'What the call is looking for.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			opens_at: text('2026-11-01', 'When applications open (YYYY-MM-DD).', 10),
			closes_at: text('2026-12-15', 'When applications close (YYYY-MM-DD).', 10)
		}
	}
};

/**
 * An application to a call. Personal: each applicant creates, saves and resumes their own, with no Role.
 * Community: staff holding CanGetDynamicEntityRecord_cohort_application at the space read every application.
 * Staff decisions are separate records, never edits to the applicant's own.
 */
export const applicationEntity: SystemDynamicEntityDefinition = {
	entity_name: APPLICATION,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	auth_mode: 'UserOnly',
	schema: {
		description: 'An application to a call, owned by the applicant. Saved as a draft until it is submitted.',
		required: ['call_id', 'status'],
		properties: {
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call applied to.', 36, 1),
			status: text('draft', 'draft or submitted.', 20, 1),
			startup_name: text('Example Pay', 'The name of the startup or project.'),
			sector: text('payments', 'The fintech sector, e.g. payments, lending, regtech.', 100),
			stage: text('mvp', 'idea, mvp, early_revenue or growth.', 20),
			website: text('https://example.com', 'The startup website, if any.', 500),
			problem_statement: text('Small merchants cannot accept card payments cheaply.', 'The problem the startup solves.', 4000),
			solution: text('A QR payment app with low fees.', 'The proposed solution.', 4000),
			market_understanding: text('Most small merchants still only take cash.', 'Understanding of the local market.', 4000),
			team_size: { type: 'integer', example: 3, description: 'How many people are on the team.' },
			local_resident: { type: 'boolean', example: true, description: "The applicant is a citizen or resident of the programme's country." },
			incorporated_locally: { type: 'boolean', example: false, description: "The business is incorporated in the programme's country." },
			eligibility: text('eligible', 'Set on submission: eligible or needs_review.', 20),
			submitted_at: text('2026-11-20T10:00:00Z', 'When the application was submitted (ISO 8601, UTC).', 30),
			customer_id: text('7uy8a7e4-6d02-40e3-a129-0b2bf89de9f0', "The applicant's Customer in the space: the legal person, and where emails go.", 36)
		}
	}
};

/**
 * A screening decision on an application. Append-only: staff create decisions and nobody is given the update or
 * delete Roles, so the history stays as it was written. UserXORApplication, so Cohort itself (with the Get Scope)
 * reads the decisions on an applicant's own application to show them the outcome; applicants hold no Role.
 */
export const screeningDecisionEntity: SystemDynamicEntityDefinition = {
	entity_name: SCREENING_DECISION,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	auth_mode: 'UserXORApplication',
	schema: {
		description: 'A screening decision on an application, written by staff. The latest one is the current outcome.',
		required: ['application_id', 'decision', 'decided_at'],
		properties: {
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application decided on.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call the application is for.', 36),
			decision: text('shortlisted', 'shortlisted, rejected or needs_info.', 20, 1),
			reason: text('Strong team, clear market.', 'Why, for staff only.', 4000),
			message_to_applicant: text('Please add your team size.', 'What the applicant is told.', 4000),
			decided_by_username: text('felixsmith', 'Who decided, as shown to staff.', 255),
			decided_at: text('2026-11-25T09:00:00Z', 'When the decision was made (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A conversation with Opey, recorded by Cohort as the User after each message: the audit log of questions and
 * answers. The Portal's definition (shared, so the two only grow together) under Cohort's name, in Cohort's space.
 * Personal: each User sees only their own. Community: auditors holding CanGetDynamicEntityRecord_cohort_opey_conversation
 * at the space read every conversation, read only. Anonymous visitors' chats are not recorded.
 */
export const opeyConversationEntity: SystemDynamicEntityDefinition = {
	...(PORTAL_OPEY_CONVERSATION_ENTITY as SystemDynamicEntityDefinition),
	entity_name: OPEY_CONVERSATION,
	has_community_access: true,
	schema: {
		...PORTAL_OPEY_CONVERSATION_ENTITY.schema,
		description:
			'A conversation between a User and Opey in Cohort, written by Cohort as the User after each message completes. Personal: each User sees only their own conversations; auditors with the Get Role read all of them.'
	}
};

const integer = (example: number, description: string) => ({ type: 'integer', example, description });

/** A criterion of a call's scoring rubric. Public, so applicants see how they are judged; staff create them. */
export const rubricCriterionEntity: SystemDynamicEntityDefinition = {
	entity_name: RUBRIC_CRITERION,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: "A criterion of a call's scoring rubric: reviewers score each submitted application on it.",
		required: ['call_id', 'name', 'max_score'],
		properties: {
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call this criterion belongs to.', 36, 1),
			name: text('Team', 'What is scored.', 255, 1),
			description: text('Does the team have the skills to deliver?', 'Guidance for reviewers.', 2000),
			max_score: integer(5, 'The highest score (the lowest is 0).'),
			weight: integer(1, 'How much it counts relative to the other criteria; 1 when not set.'),
			position: integer(1, 'Its place in the rubric.')
		}
	}
};

/**
 * Someone who offers to review applications, with their expertise. Personal: each person creates their own, with no
 * Role. Community: staff holding the Get Role read the whole pool, to assign reviewers from it.
 */
export const reviewerEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEWER,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A person who offers to review applications. Staff assign reviewers from these.',
		required: ['user_id', 'display_name'],
		properties: {
			user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The User who offers to review.', 255, 1),
			display_name: text('Felix Smith', 'The name staff see.', 255, 1),
			expertise: text('Payments, regulation', 'What they know about.', 1000),
			status: text('available', 'available or unavailable.', 20)
		}
	}
};

/**
 * Staff accepting or declining an offer to review. Append-only, like screening decisions: the latest one is the
 * reviewer's standing, and only an accepted reviewer is assigned applications and sees their assignments. It is not a
 * field on the offer, which is the reviewer's own record. UserXORApplication, so Cohort itself (with the Get Scope)
 * reads a reviewer's standing; reviewers hold no Role.
 */
export const reviewerDecisionEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEWER_DECISION,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	auth_mode: 'UserXORApplication',
	schema: {
		description: 'Staff accepting or declining an offer to review. The latest one is the current standing.',
		required: ['reviewer_user_id', 'decision', 'decided_at'],
		properties: {
			reviewer_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_reviewer offer decided on.', 36),
			reviewer_user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The User who offered to review.', 255, 1),
			decision: text('accepted', 'accepted or declined.', 20, 1),
			reason: text('Ten years in payments.', 'Why, for staff only.', 4000),
			decided_by_username: text('janedoe', 'Who decided, as shown to staff.', 255),
			decided_at: text('2026-11-25T09:00:00Z', 'When the decision was made (ISO 8601, UTC).', 30, 1)
		}
	}
};

/** A reviewer assigned to an application. Staff create assignments; they are never edited. */
export const reviewAssignmentEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEW_ASSIGNMENT,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A reviewer assigned to review an application.',
		required: ['application_id', 'call_id', 'reviewer_user_id', 'assigned_at'],
		properties: {
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application to review.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'Its cohort_call.', 36, 1),
			reviewer_user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The reviewer.', 255, 1),
			reviewer_name: text('Felix Smith', "The reviewer's display name.", 255),
			assigned_by_username: text('janedoe', 'Who assigned it.', 255),
			assigned_at: text('2026-11-25T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1),
			due_on: text('2026-12-05', 'When the review is due (YYYY-MM-DD).', 10)
		}
	}
};

/**
 * A reviewer's review of an application. Personal: the reviewer writes their own, with no Role. It first records
 * whether they have a conflict of interest; with one, there are no scores and staff reassign the application.
 * Community: staff holding the Get Role read every review, for ranking.
 */
export const reviewEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEW,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A review of an application, written by its reviewer: a conflict-of-interest declaration, and scores.',
		required: ['assignment_id', 'application_id', 'conflict_of_interest', 'submitted_at'],
		properties: {
			assignment_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_review_assignment.', 36, 1),
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application reviewed.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'Its cohort_call.', 36),
			conflict_of_interest: { type: 'boolean', example: false, description: 'The reviewer declared a conflict of interest.' },
			conflict_note: text('I advise this company.', 'The conflict, for staff.', 1000),
			scores_json: text('{"criterion-id":4}', 'The score for each cohort_rubric_criterion, by its id.', 4000),
			total_score: integer(80, 'The weighted score out of 100.'),
			comments: text('Strong team; unclear market.', "The reviewer's comments, for staff.", 4000),
			submitted_at: text('2026-11-28T10:00:00Z', 'When it was submitted (ISO 8601, UTC).', 30, 1)
		}
	}
};

export const COHORT_ENTITIES: SystemDynamicEntityDefinition[] = [
	programmeEntity,
	callEntity,
	applicationEntity,
	screeningDecisionEntity,
	opeyConversationEntity,
	rubricCriterionEntity,
	reviewerEntity,
	reviewerDecisionEntity,
	reviewAssignmentEntity,
	reviewEntity
];
